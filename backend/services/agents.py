"""
Multi-agent system with MCP (Model Context Protocol) tool layer.

Architecture:
  PlannerAgent        → Classifies intent, selects tools, plans retrieval
  MCPToolAgent        → Executes MCP tools (async, parallel)
  ReasonerAgent       → Synthesizes memory + tool outputs → final answer
  ValidatorAgent      → Grounds and validates final response
  MultiAgentOrchestrator → Coordinates the full pipeline (fully async)
"""
import asyncio
import json
import logging
import re
import uuid
from typing import Dict, List, Any, Optional
from datetime import datetime

from backend.services.llm import get_llm_service
from backend.services.retrieval import get_retrieval_service
from backend.mcp.schemas import ToolCall, MCPPlan, ToolOutput, ToolEvent

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helper: robust JSON extraction
# ---------------------------------------------------------------------------
def _extract_json(text: str) -> Optional[dict]:
    """Extract the first valid JSON object from a string."""
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return None


# ---------------------------------------------------------------------------
# Retrieval Tool (sync, but called via run_in_executor)
# ---------------------------------------------------------------------------
class RetrievalTool:
    """Tool for agents to retrieve relevant context from vector store."""

    def __init__(self):
        self.retrieval_service = get_retrieval_service()

    def __call__(self, workspace_id: uuid.UUID, query: str, top_k: int = 5) -> List[Dict]:
        return self.retrieval_service.retrieve_context(workspace_id, query, top_k)

    async def async_retrieve(self, workspace_id: uuid.UUID, query: str, top_k: int = 5) -> List[Dict]:
        """Non-blocking async retrieval using thread executor."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self, workspace_id, query, top_k)


# ---------------------------------------------------------------------------
# Planner Agent
# ---------------------------------------------------------------------------
class PlannerAgent:
    """
    Plans the full execution strategy:
    - Intent classification
    - Memory retrieval queries
    - MCP tool selection
    """

    def __init__(self):
        self.llm_service = get_llm_service()
        self._tool_descriptions = ""

    def _get_tool_descriptions(self) -> str:
        if not self._tool_descriptions:
            try:
                from backend.mcp.registry import get_tool_descriptions_for_planner
                self._tool_descriptions = get_tool_descriptions_for_planner()
            except Exception:
                self._tool_descriptions = "No tools available."
        return self._tool_descriptions

    async def execute(self, user_query: str, chat_history: list = None) -> MCPPlan:
        tools_text = self._get_tool_descriptions()

        # Build recent history summary
        recent_summary = ""
        if chat_history:
            recent_turns = chat_history[-4:]
            recent_summary = "\n".join([
                f"{m.get('role', 'user').upper()}: {str(m.get('content', ''))[:100]}"
                for m in recent_turns
            ])

        system_prompt = f"""You are the Strategic Planning Agent for Devasya AI — a senior AI orchestrator.

Your job: Analyze the user query and output a precise execution plan in JSON.

AVAILABLE MCP TOOLS:
{tools_text}

INTENT CATEGORIES:
- Resume Review: analyzing resume content, ATS score, sections
- Career Advice: salary targets, roadmap, skill gaps
- Project Feedback: reviewing code, projects, architecture
- GitHub Review: reviewing a GitHub repository (needs review_github_repo tool)
- Job Search: finding jobs or internships (needs search_jobs tool)
- Web Research: latest news, comparisons, current events (needs web_search tool)
- Model Comparison: comparing AI models (needs compare_models tool)
- Emotional/Frustration: user correcting or upset
- Clarification: follow-up on previous answer
- Learning/Technical: explaining concepts
- Personal/Memory: what the AI knows about the user
- General Chat: casual conversation

TOOL SELECTION RULES:
- Only select a tool if the query REQUIRES external data or specific action.
- "review my resume" / "ATS score" → use analyze_resume
- "find jobs" / "search internships" → use search_jobs
- "review my github" / GitHub URL present → use review_github_repo
- "latest news" / "what's happening with X" / "current state of" → use web_search
- "compare GPT vs Claude" / "which model is better" → use compare_models
- Normal chat, greetings, career questions from memory → NO tools needed

RETRIEVAL RULES:
- Always retrieve if query references the user's past, profile, projects, or resume
- Generate 1-3 targeted search queries for retrieval

Respond in JSON ONLY:
{{
    "intent": "<intent category>",
    "needs_retrieval": true/false,
    "search_queries": ["<query1>", "<query2>"],
    "needs_tools": true/false,
    "tool_calls": [
        {{
            "tool_name": "<exact tool name>",
            "parameters": {{}},
            "reason": "<why this tool is needed>"
        }}
    ],
    "analysis_type": "<resume_review|career_advice|project_feedback|general>",
    "reasoning": "<brief explanation>"
}}"""

        try:
            response_text = await self.llm_service.async_generate(
                prompt=f"Recent conversation:\n{recent_summary}\n\nCurrent user query: {user_query}",
                system_prompt=system_prompt,
            )
            data = _extract_json(response_text)
            if data:
                raw_tool_calls = data.get("tool_calls", [])
                tool_calls = []
                for tc in raw_tool_calls:
                    if isinstance(tc, dict) and tc.get("tool_name"):
                        tool_calls.append(ToolCall(
                            tool_name=tc["tool_name"],
                            parameters=tc.get("parameters", {}),
                            reason=tc.get("reason", ""),
                        ))
                return MCPPlan(
                    intent=data.get("intent", "General Chat"),
                    needs_retrieval=data.get("needs_retrieval", True),
                    needs_tools=data.get("needs_tools", False) and bool(tool_calls),
                    search_queries=data.get("search_queries", [user_query]),
                    tool_calls=tool_calls,
                    analysis_type=data.get("analysis_type", "analysis"),
                    reasoning=data.get("reasoning", ""),
                )
        except Exception as e:
            logger.error(f"Planner agent error: {e}", exc_info=True)

        # Safe default
        return MCPPlan(
            intent="General Chat",
            needs_retrieval=True,
            needs_tools=False,
            search_queries=[user_query],
            tool_calls=[],
            analysis_type="analysis",
            reasoning="Default fallback plan.",
        )


# ---------------------------------------------------------------------------
# MCP Tool Agent
# ---------------------------------------------------------------------------
class MCPToolAgent:
    """Executes MCP tool calls planned by the Planner."""

    async def execute(
        self,
        tool_calls: List[ToolCall],
        user_context: Dict[str, Any],
    ) -> tuple[List[ToolOutput], List[ToolEvent]]:
        if not tool_calls:
            return [], []
        from backend.mcp.executor import execute_tools
        return await execute_tools(tool_calls, user_context)


# ---------------------------------------------------------------------------
# Reasoner Agent
# ---------------------------------------------------------------------------
class ReasonerAgent:
    """Synthesizes all context layers into a final, premium response."""

    def __init__(self):
        self.llm_service = get_llm_service()

    async def execute(
        self,
        user_query: str,
        memory_context: str,
        tool_context: str,
        user_profile: Optional[Dict] = None,
        analysis_type: str = "analysis",
        intent: str = "general",
        chat_history: list = None,
    ) -> Dict[str, str]:
        system_prompt = """You are the Core Intelligence Engine of Devasya AI — a premium, \
strategic, and deeply context-aware AI companion with the reasoning of a top-tier senior engineer and product founder.

OPERATING PRINCIPLES:
1. DEEP PERSONALIZATION: You know this user. Use their profile (skills, projects, goals) \
to ground every answer. Reference their actual work naturally.
2. TOOL OUTPUT INTEGRATION: When tool results are provided, USE THEM as the primary source \
of truth. Convert raw tool data into premium human-readable responses. Never dump raw JSON.
3. STRATEGIC REASONING: Answer the "why" and "how" — connect the query to their long-term goals.
4. ADAPTIVE TONE & RECOVERY: Detect frustration or corrections in history. \
Acknowledge mistakes immediately and pivot gracefully.
5. DECISIVE AUTHORITY: No wishy-washy language. Be bold, direct, and specific.
6. For simple greetings or casual questions, respond naturally and conversationally.

RESPONSE FORMAT RULES:
- If asked for a rating/score → provide it in the VERY FIRST line.
- If tool results are available → lead with the most important finding.
- No generic buzzwords. No filler. Zero irrelevant output.
- Use markdown formatting for structured content where appropriate."""

        messages_list = [{"role": "system", "content": system_prompt}]

        if chat_history:
            messages_list.extend(chat_history[-10:])

        profile_str = json.dumps(user_profile, indent=2) if user_profile else "No profile data available."
        memory_str = (
            memory_context
            if memory_context and memory_context != "No relevant context found in memory."
            else "None"
        )

        recent_history = []
        if chat_history:
            recent_history = [
                {
                    "role": m.get("role"),
                    "content": (
                        str(m.get("content", ""))[:200] + "..."
                        if len(str(m.get("content", ""))) > 200
                        else m.get("content")
                    ),
                }
                for m in chat_history[-5:]
            ]

        current_content = f"""USER PROFILE (Long-term Knowledge):
{profile_str}

CONVERSATION CONTEXT (Last 5 turns):
{json.dumps(recent_history)}

RETRIEVED MEMORY (From uploaded docs & past context):
{memory_str}

TOOL RESULTS (From executed MCP tools — treat as ground truth):
{tool_context if tool_context else "No tools were executed for this query."}

CURRENT USER QUERY:
"{user_query}"

DETECTED INTENT: {intent}

INSTRUCTIONS:
1. Check if the user is frustrated or correcting you from history. If yes, acknowledge it first.
2. If tool results are available, USE THEM as the foundation of your answer.
3. Ground the response in the user's profile (their actual skills, projects, goals).
4. If no tools ran and no memory exists, respond naturally and helpfully.
5. Think like a senior advisor who knows this person deeply.

Output strictly valid JSON only:
{{
    "insight": "Your internal strategic thinking — how you are connecting all data sources.",
    "answer": "Your final, authoritative, beautifully formatted response to the user. (CRITICAL: Use '\\n' for newlines, DO NOT output raw newlines inside the string!)",
    "action": "The single most important next action the user should take right now."
}}
(Ensure the output is 100% parseable by json.loads() - escape all quotes and newlines!)"""

        messages_list.append({"role": "user", "content": current_content})

        try:
            response_text = await self.llm_service.async_generate(
                prompt=None,
                messages_list=messages_list,
                max_tokens=1500,
            )
            data = _extract_json(response_text)
            if data:
                return data
            # If the model didn't return JSON, treat the full text as the answer
            return {"answer": response_text, "insight": "", "action": ""}
        except Exception as e:
            logger.error(f"Reasoner agent error: {e}", exc_info=True)
            return {
                "answer": "I encountered an issue generating a response. Please try again.",
                "insight": "Error in reasoning pipeline.",
                "action": "Retry your query.",
            }


# ---------------------------------------------------------------------------
# Validator Agent
# ---------------------------------------------------------------------------
class ValidatorAgent:
    """Validates the response for hallucination and grounding."""

    def __init__(self):
        self.llm_service = get_llm_service()

    async def execute(
        self,
        user_query: str,
        context: str,
        response: Dict[str, str],
    ) -> Dict[str, Any]:
        # Skip validation for simple greetings to save latency
        if len(user_query.strip()) < 20 and not context:
            return {"is_valid": True, "grounding_score": 1.0, "issues": [], "feedback": ""}

        validation_prompt = f"""Briefly review this AI response:

User Query: {user_query}
Context available: {"Yes" if context and context != "None" else "No"}
Response: {response.get("answer", "")[:300]}

Respond in JSON:
{{
    "is_valid": true/false,
    "grounding_score": <0.0-1.0>,
    "issues": [],
    "feedback": "<brief note>"
}}"""

        try:
            result_text = await self.llm_service.async_generate(
                prompt=validation_prompt,
                system_prompt="You are a concise validation agent. Output only valid JSON.",
            )
            data = _extract_json(result_text)
            if data:
                return data
        except Exception as e:
            logger.error(f"Validator agent error: {e}")

        return {"is_valid": True, "grounding_score": 0.8, "issues": [], "feedback": ""}


# ---------------------------------------------------------------------------
# Multi-Agent Orchestrator
# ---------------------------------------------------------------------------
class MultiAgentOrchestrator:
    """
    Coordinates the full agentic pipeline:
    Plan → Retrieve → Execute Tools → Reason → Validate
    All operations are fully async.
    """

    def __init__(self):
        self.planner = PlannerAgent()
        self.mcp_agent = MCPToolAgent()
        self.reasoner = ReasonerAgent()
        self.validator = ValidatorAgent()
        self.retrieval_tool = RetrievalTool()

    async def _async_execute(
        self,
        user_id: uuid.UUID,
        workspace_id: uuid.UUID,
        user_query: str,
        user_profile: Optional[Dict] = None,
        chat_history: list = None,
    ) -> Dict[str, Any]:
        """Full async pipeline execution."""
        execution_log = {
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": str(user_id),  # str to ensure JSON-serializable
            "query": user_query,
            "steps": [],
        }

        try:
            # ----------------------------------------------------------------
            # Step 1: Plan (async LLM call)
            # ----------------------------------------------------------------
            logger.info("[Orchestrator] Step 1: Planning")
            plan: MCPPlan = await self.planner.execute(user_query, chat_history)
            execution_log["steps"].append({"agent": "planner", "output": plan.dict()})
            logger.info(
                f"[Orchestrator] Plan: intent={plan.intent}, "
                f"retrieval={plan.needs_retrieval}, "
                f"tools={[tc.tool_name for tc in plan.tool_calls]}"
            )

            # ----------------------------------------------------------------
            # Step 2: Memory Retrieval (async, in thread executor)
            # ----------------------------------------------------------------
            retrieved_docs: List[Dict] = []
            memory_context = ""

            if plan.needs_retrieval:
                logger.info("[Orchestrator] Step 2: Retrieving memory")
                queries = plan.search_queries or [user_query]

                # Run all retrieval queries concurrently
                retrieval_tasks = [
                    self.retrieval_tool.async_retrieve(workspace_id, q, top_k=4)
                    for q in queries[:3]
                ]
                results = await asyncio.gather(*retrieval_tasks, return_exceptions=True)

                docs = []
                for r in results:
                    if isinstance(r, list):
                        docs.extend(r)

                # Deduplicate
                seen = set()
                for d in docs:
                    text = d.get("content", "").strip()
                    if text and text not in seen:
                        seen.add(text)
                        retrieved_docs.append(d)
                retrieved_docs = retrieved_docs[:6]
                memory_context = self._format_context(retrieved_docs)
                execution_log["steps"].append({
                    "agent": "retriever",
                    "documents_retrieved": len(retrieved_docs),
                })

            # ----------------------------------------------------------------
            # Step 3: MCP Tool Execution (async, parallel)
            # ----------------------------------------------------------------
            tool_outputs: List[ToolOutput] = []
            tool_events: List[ToolEvent] = []
            tool_context = ""

            if plan.needs_tools and plan.tool_calls:
                logger.info(f"[Orchestrator] Step 3: Executing {len(plan.tool_calls)} MCP tools")

                from backend.mcp.context import build_user_context
                from backend.mcp.executor import format_tool_outputs_for_reasoner

                has_docs = len(retrieved_docs) > 0
                user_ctx = build_user_context(
                    user_profile=user_profile,
                    memory_summary=memory_context[:800] if memory_context else "",
                    has_uploaded_documents=has_docs,
                )

                tool_outputs, tool_events = await self.mcp_agent.execute(
                    plan.tool_calls, user_ctx
                )
                tool_context = format_tool_outputs_for_reasoner(tool_outputs)
                execution_log["steps"].append({
                    "agent": "mcp_tool_agent",
                    "tools_executed": [tc.tool_name for tc in plan.tool_calls],
                    "success_count": sum(
                        1 for o in tool_outputs if o.status.value == "success"
                    ),
                })

            # ----------------------------------------------------------------
            # Step 4: Reasoning — synthesize everything (async LLM call)
            # ----------------------------------------------------------------
            logger.info("[Orchestrator] Step 4: Reasoning")
            response = await self.reasoner.execute(
                user_query=user_query,
                memory_context=memory_context,
                tool_context=tool_context,
                user_profile=user_profile,
                analysis_type=plan.analysis_type,
                intent=plan.intent,
                chat_history=chat_history,
            )
            execution_log["steps"].append({"agent": "reasoner"})

            # ----------------------------------------------------------------
            # Step 5: Validate (async, skip for simple queries)
            # ----------------------------------------------------------------
            logger.info("[Orchestrator] Step 5: Validating")
            validation = await self.validator.execute(user_query, memory_context, response)
            execution_log["steps"].append({"agent": "validator", "validation": validation})

            # ----------------------------------------------------------------
            # Build return payload
            # ----------------------------------------------------------------
            context_sources = []
            if retrieved_docs:
                context_sources.append(f"{len(retrieved_docs)} memory sources retrieved.")
            if tool_outputs:
                succeeded = sum(1 for o in tool_outputs if o.status.value == "success")
                context_sources.append(
                    f"{succeeded}/{len(tool_outputs)} tools executed successfully."
                )

            return {
                "insights": response.get("answer", ""),
                "connections": response.get("insight", ""),
                "actions": response.get("action", ""),
                "context": context_sources,
                "tool_events": [e.dict() for e in tool_events],
                "agent_logs": execution_log,
                "validation": validation,
            }

        except Exception as e:
            logger.error(f"[Orchestrator] Pipeline error: {e}", exc_info=True)
            return {
                "insights": "I encountered an unexpected error. Please try again.",
                "connections": "Error in pipeline.",
                "actions": "Retry your query.",
                "context": [],
                "tool_events": [],
                "agent_logs": execution_log,
                "error": str(e),
            }

    def _format_context(self, documents: List[Dict]) -> str:
        """Format retrieved documents into a context string."""
        if not documents:
            return "No relevant context found in memory."
        parts = []
        for doc in documents:
            content = doc.get("content", "")
            if len(content) > 2000:
                content = content[:1997] + "..."
            parts.append(content)
        return "\n\n".join(parts)


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------
_orchestrator: Optional[MultiAgentOrchestrator] = None


def get_orchestrator() -> MultiAgentOrchestrator:
    """Get or initialize the global orchestrator."""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = MultiAgentOrchestrator()
    return _orchestrator

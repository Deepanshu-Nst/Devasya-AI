"""
Multi-agent system using LangGraph for reasoning and generation.
"""
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

from backend.services.llm import get_llm_service
from backend.services.retrieval import get_retrieval_service

logger = logging.getLogger(__name__)


class RetrievalTool:
    """Tool for agents to retrieve relevant context."""
    
    def __init__(self):
        self.retrieval_service = get_retrieval_service()
    
    def __call__(self, user_id: int, query: str, top_k: int = 5) -> List[Dict]:
        """Retrieve context from memory."""
        return self.retrieval_service.retrieve_context(user_id, query, top_k)


class PlannerAgent:
    """Agent for understanding user intent and planning steps."""
    
    def __init__(self):
        self.llm_service = get_llm_service()
    
    def execute(self, user_query: str) -> Dict[str, Any]:
        """
        Plan the reasoning steps needed.
        
        Returns:
            Plan with steps and whether retrieval is needed
        """
        system_prompt = """You are a planning agent for a cognitive AI. Analyze the user query and decide:
1. Whether memory retrieval is needed (from user's uploaded resume, profile, or history)
2. What optimized search queries to run against the vector database (e.g. if asked "rate my resume", use queries like "skills experience professional background", NOT just the word "resume").

Respond in JSON format:
{
    "needs_retrieval": boolean,
    "search_queries": ["query1", "query2"],
    "analysis_type": "analysis",
    "reasoning": "string"
}"""
        
        try:
            response_text = self.llm_service.generate(
                prompt=f"Query: {user_query}",
                system_prompt=system_prompt
            )
            
            # Parse JSON response
            import re
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            else:
                return {
                    "needs_retrieval": True,
                    "analysis_type": "analysis",
                    "reasoning": "Default behavior"
                }
        except Exception as e:
            logger.error(f"Planner agent error: {e}")
            return {
                "needs_retrieval": True,
                "analysis_type": "analysis",
                "reasoning": f"Error in planning: {str(e)}"
            }


class ReasonerAgent:
    """Agent for generating insights based on context."""
    
    def __init__(self):
        self.llm_service = get_llm_service()
    
    def execute(
        self,
        user_query: str,
        context: str,
        analysis_type: str = "analysis",
        chat_history: list = None
    ) -> Dict[str, str]:
        """
        Generate structured insights from context.
        
        Returns:
            Dict with insights, connections, and actions
        """
        system_prompt = """You are an elite, highly intelligent AI assistant—a sharp, adaptive senior engineer and product founder.

Before answering:

1. Identify the user's intent:
   - Evaluation (e.g., "rate my resume", "what do you think")
   - Improvement (e.g., "how can I improve")
   - Exploration (e.g., "what should I build")
   - Technical (e.g., "which tech", "how to implement")

2. STRICT RULE:
   - If Evaluation → Answer ONLY evaluation first (no suggestions unless asked). Do NOT jump to building or suggesting if user asked for feedback.
   - If Improvement → Give actionable improvements
   - If Technical → Give stack + architecture
   - If Exploration → Suggest ONE strong idea

Goal:
Answer EXACTLY what the user asked. No assumption. No overreach.

RESPONSE ORDER CONTROL:
If the user explicitly asks for something (rating, opinion, yes/no):
→ Answer it in the FIRST line.
Then optionally expand.

CORE INSIGHT ENGINE & DECISIVENESS:
When giving strategic advice or suggesting something (per the intent rules):
1. Pick the SINGLE highest-impact idea. Prioritize one massive leverage point.
2. Clearly explain WHY it wins (e.g., retention, defensibility, business revenue).
3. Break it down into execution clarity (how to build it tomorrow).

AUTHORITY & TONE:
- Speak with decisive authority. BAN words like "you could", "consider adding", or "maybe explore". Use "Build this." or "Your real bottleneck is X. Do Y."
- Be non-generic, brutally practical, and crisp. Zero irrelevant output."""
        
        messages_list = [{"role": "system", "content": system_prompt}]
        
        if chat_history:
            messages_list.extend(chat_history[-10:])
            
        memory_str = context if context and context != "No relevant context found in memory." else "None"
        
        # Extract recent context for reasoning
        recent_history = []
        if chat_history:
            recent_history = [{"role": m.get("role"), "content": str(m.get("content", ""))[:150] + "..." if len(str(m.get("content", ""))) > 150 else m.get("content")} for m in chat_history[-3:]]
        
        current_content = f"""User asked: "{user_query}"

Recent context (last 3 turns):
{json.dumps(recent_history)}

Available Memory:
{memory_str}

Instructions for Thinking Loop:
1. Identify Intent: Is it Evaluation, Improvement, Exploration, or Technical?
2. Process Strategy (in "insight"): Define the exact boundaries of the answer based on intent. If Evaluation, formulate the rating/opinion explicitly and DO NOT overreach into suggestions.
3. Output "answer": Deliver a sharp, decisive response. If they asked for a rating or opinion, MUST provide it in the very first line. Give zero irrelevant output and BAN weak consultant phrases.

Generate structured response in JSON only:
{{
    "insight": "Your internal monologue: intent identification, enforcing strict response rules, and defining the core answer bounds.",
    "answer": "Your decisive, authoritative response. If requested, the rating/opinion or direct answer is in the very first line.",
    "action": ""
}}"""
        
        messages_list.append({"role": "user", "content": current_content})
        
        try:
            response_text = self.llm_service.generate(
                prompt=None,
                messages_list=messages_list,
                max_tokens=1000
            )
            
            # Parse JSON response
            import re
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            else:
                return {
                    "answer": "Unable to generate insights",
                    "insight": "Unable to identify connections",
                    "action": "Please rephrase your query"
                }
        except Exception as e:
            logger.error(f"Reasoner agent error: {e}")
            return {
                "answer": f"Error: {str(e)}",
                "insight": "Error processing",
                "action": "Try again"
            }


class ValidatorAgent:
    """Agent for validating outputs and ensuring grounding."""
    
    def __init__(self):
        self.llm_service = get_llm_service()
    
    def execute(
        self,
        user_query: str,
        context: str,
        response: Dict[str, str]
    ) -> Dict[str, Any]:
        """
        Validate the response for hallucination and structure.
        
        Returns:
            Validation result with is_valid and feedback
        """
        validation_prompt = f"""Review this response for:
1. Is it grounded in the provided context?
2. Does it avoid hallucination?
3. Is the structure valid (insights, connections, actions)?

User Query: {user_query}
Context: {context if context else "No context"}
Response: {json.dumps(response)}

Respond in JSON:
{{
    "is_valid": boolean,
    "grounding_score": number (0-1),
    "issues": [string],
    "feedback": string
}}"""
        
        try:
            result_text = self.llm_service.generate(
                prompt=validation_prompt,
                system_prompt="You are a validation agent."
            )
            
            import re
            json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            else:
                return {
                    "is_valid": True,
                    "grounding_score": 0.8,
                    "issues": [],
                    "feedback": "Validation inconclusive"
                }
        except Exception as e:
            logger.error(f"Validator agent error: {e}")
            return {
                "is_valid": False,
                "grounding_score": 0,
                "issues": [str(e)],
                "feedback": "Validation error"
            }


class MultiAgentOrchestrator:
    """Orchestrates multi-agent reasoning pipeline."""
    
    def __init__(self):
        self.planner = PlannerAgent()
        self.reasoner = ReasonerAgent()
        self.validator = ValidatorAgent()
        self.retrieval_tool = RetrievalTool()
        self.llm_service = get_llm_service()
    
    def execute(
        self,
        user_id: int,
        user_query: str,
        chat_history: list = None
    ) -> Dict[str, Any]:
        """
        Execute full multi-agent pipeline.
        
        Returns:
            Final structured output with metadata
        """
        execution_log = {
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
            "query": user_query,
            "steps": []
        }
        
        try:
            # Step 1: Planning
            logger.info("Step 1: Planner agent executing")
            plan = self.planner.execute(user_query)
            execution_log["steps"].append({
                "agent": "planner",
                "output": plan
            })
            
            # Step 2: Retrieval (if needed)
            context = ""
            retrieved_docs = []
            if plan.get("needs_retrieval", True):
                logger.info("Step 2: Retrieving context")
                
                # Use optimized queries from planner, or fallback to user query
                search_queries = plan.get("search_queries", [user_query])
                if not search_queries:
                    search_queries = [user_query]
                
                docs = []
                for sq in search_queries[:2]: # Try up to 2 distinct queries
                    docs.extend(self.retrieval_tool(user_id, sq, top_k=3))
                
                # Deduplicate and take top 4
                unique_docs = []
                seen_texts = set()
                for d in docs:
                    text = d.get("content", "").strip()
                    if text and text not in seen_texts:
                        seen_texts.add(text)
                        unique_docs.append(d)
                retrieved_docs = unique_docs[:4]
                context = self._format_context(retrieved_docs)
                execution_log["steps"].append({
                    "agent": "retriever",
                    "documents_retrieved": len(retrieved_docs)
                })
            
            # Step 3: Reasoning
            logger.info("Step 3: Reasoner agent executing")
            analysis_type = plan.get("analysis_type", "analysis")
            response = self.reasoner.execute(user_query, context, analysis_type, chat_history)
            execution_log["steps"].append({
                "agent": "reasoner",
                "output": response
            })
            
            # Step 4: Validation
            logger.info("Step 4: Validator agent executing")
            validation = self.validator.execute(user_query, context, response)
            execution_log["steps"].append({
                "agent": "validator",
                "validation": validation
            })
            
            # Return final output
            return {
                "insights": response.get("answer", response.get("insights", "")),
                "connections": response.get("insight", response.get("connections", "")),
                "actions": response.get("action", response.get("actions", "")),
                "context": [f"{len(retrieved_docs)} memory sources retrieved."] if retrieved_docs else [],
                "agent_logs": execution_log,
                "validation": validation
            }
        
        except Exception as e:
            logger.error(f"Multi-agent orchestration error: {e}")
            return {
                "insights": "Error during processing",
                "connections": "Processing failed",
                "actions": "Please try again",
                "context": [],
                "agent_logs": execution_log,
                "error": str(e)
            }
    
    def _format_context(self, documents: List[Dict]) -> str:
        """Format retrieved documents into context string."""
        if not documents:
            return "No relevant context found in memory."
        
        context_parts = []
        for i, doc in enumerate(documents, 1):
            content = doc.get("content", "")
            if len(content) > 2000:
                content = content[:1997] + "..."
            context_parts.append(content)
        
        return "\n\n".join(context_parts)


# Global orchestrator instance
_orchestrator = None


def get_orchestrator() -> MultiAgentOrchestrator:
    """Get multi-agent orchestrator instance."""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = MultiAgentOrchestrator()
    return _orchestrator

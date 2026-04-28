"""
web_search MCP Tool.

Fetches live web results using DuckDuckGo (free, no key required)
and summarizes them with the LLM into a clean, structured answer.
"""
import logging
from typing import Any, Dict

from backend.mcp.registry import register_tool
from backend.mcp.schemas import ToolDefinition

logger = logging.getLogger(__name__)

_DEFINITION = ToolDefinition(
    name="web_search",
    description=(
        "Search the live web for fresh information on any topic. "
        "Returns summarized findings with sources."
    ),
    input_schema={
        "query": {"type": "string", "description": "Search query."},
    },
    timeout_seconds=25,
    tags=["web", "search", "news", "research", "latest"],
)


async def _handle_web_search(
    query: str = "",
    user_context: Dict[str, Any] = None,
    **kwargs,
) -> Dict[str, Any]:
    if not query:
        return {"error": "No search query provided.", "summary": "Please provide a query."}

    from backend.mcp.adapters.web import duckduckgo_search, serpapi_search
    from backend.config.settings import settings
    from backend.services.llm import get_llm_service

    # Try SerpAPI first if key available, else use DuckDuckGo
    serpapi_key = getattr(settings, "SERPAPI_KEY", None)
    if serpapi_key:
        results = await serpapi_search(query, api_key=serpapi_key, max_results=6)
    else:
        results = await duckduckgo_search(query, max_results=6)

    if not results:
        return {
            "summary": f"No web results found for: {query}",
            "results": [],
            "query": query,
        }

    results_text = "\n".join([
        f"- [{r['title']}]({r['url']}): {r['snippet']}"
        for r in results if r.get("snippet")
    ])

    llm = get_llm_service()
    prompt = f"""Based on these web search results for "{query}", provide a clear, accurate summary.

SEARCH RESULTS:
{results_text}

Return JSON:
{{
    "summary": "<3-5 sentence comprehensive answer based on the results>",
    "key_findings": ["<finding 1>", "<finding 2>", "<finding 3>"],
    "sources": ["<source url 1>", "<source url 2>"],
    "confidence": "<high/medium/low based on source quality>"
}}"""

    raw = llm.generate(prompt=prompt, system_prompt="You are a research analyst. Output only valid JSON.")

    import re, json
    match = re.search(r'\{.*\}', raw, re.DOTALL)
    if match:
        try:
            result = json.loads(match.group())
            result["query"] = query
            result["raw_results"] = results[:5]
            return result
        except json.JSONDecodeError:
            pass

    return {"summary": raw, "query": query, "raw_results": results[:5]}


register_tool(_DEFINITION, _handle_web_search)

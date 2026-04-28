"""
Web search adapter — Uses DuckDuckGo instant answers API (no key required)
with an optional SerpAPI fallback for richer results.
"""
import logging
from typing import List, Dict, Any
import httpx

logger = logging.getLogger(__name__)


async def duckduckgo_search(query: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """
    Search using DuckDuckGo's free instant answer API.
    Returns a list of result dicts with title, url, and snippet.
    """
    results = []
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.duckduckgo.com/",
                params={
                    "q": query,
                    "format": "json",
                    "no_html": "1",
                    "skip_disambig": "1",
                },
                headers={"User-Agent": "DevasYaAI/1.0"},
            )
            data = resp.json()

        # Abstract (top result)
        if data.get("Abstract"):
            results.append({
                "title": data.get("Heading", query),
                "url": data.get("AbstractURL", ""),
                "snippet": data.get("Abstract", ""),
                "source": data.get("AbstractSource", ""),
            })

        # Related topics
        for topic in data.get("RelatedTopics", [])[:max_results]:
            if isinstance(topic, dict) and topic.get("Text"):
                results.append({
                    "title": topic.get("Text", "")[:80],
                    "url": topic.get("FirstURL", ""),
                    "snippet": topic.get("Text", ""),
                    "source": "DuckDuckGo",
                })

    except Exception as e:
        logger.error(f"DuckDuckGo search failed: {e}")

    return results[:max_results]


async def serpapi_search(
    query: str,
    api_key: str,
    max_results: int = 5,
) -> List[Dict[str, Any]]:
    """
    Richer search using SerpAPI (requires SERPAPI_KEY env var).
    """
    results = []
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                "https://serpapi.com/search",
                params={
                    "q": query,
                    "api_key": api_key,
                    "num": max_results,
                    "engine": "google",
                },
            )
            data = resp.json()

        for item in data.get("organic_results", [])[:max_results]:
            results.append({
                "title": item.get("title", ""),
                "url": item.get("link", ""),
                "snippet": item.get("snippet", ""),
                "source": "Google",
            })
    except Exception as e:
        logger.error(f"SerpAPI search failed: {e}")

    return results

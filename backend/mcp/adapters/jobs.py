"""
Job search adapter — searches for jobs/internships using public APIs.
Primary: Remotive (remote jobs), fallback: structured LLM generation.
"""
import logging
from typing import List, Dict, Any
import httpx

logger = logging.getLogger(__name__)


async def search_remotive(
    role: str,
    tags: List[str] = None,
    max_results: int = 8,
) -> List[Dict[str, Any]]:
    """
    Search Remotive.com public API for remote jobs.
    Free, no API key required.
    """
    results = []
    try:
        search_query = role
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                "https://remotive.com/api/remote-jobs",
                params={"search": search_query, "limit": max_results},
                headers={"User-Agent": "DevasYaAI/1.0"},
            )
            if resp.status_code == 200:
                data = resp.json()
                for job in data.get("jobs", [])[:max_results]:
                    # Relevance filtering by tags if provided
                    job_tags = [t.lower() for t in job.get("tags", [])]
                    if tags:
                        match_score = sum(
                            1 for tag in tags if any(tag.lower() in jt for jt in job_tags)
                        )
                    else:
                        match_score = 1

                    results.append({
                        "title": job.get("title", ""),
                        "company": job.get("company_name", ""),
                        "location": job.get("candidate_required_location", "Worldwide"),
                        "salary": job.get("salary", "Not specified"),
                        "tags": job.get("tags", []),
                        "url": job.get("url", ""),
                        "published": job.get("publication_date", ""),
                        "match_score": match_score,
                    })

            # Sort by match score
            results.sort(key=lambda x: x["match_score"], reverse=True)

    except Exception as e:
        logger.error(f"Remotive search failed: {e}")

    return results[:max_results]

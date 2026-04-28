"""
search_jobs MCP Tool.

Searches for jobs and internships using Remotive API,
personalized by the user's profile (skills, goals, preferences).
"""
import logging
from typing import Any, Dict, List

from backend.mcp.registry import register_tool
from backend.mcp.schemas import ToolDefinition

logger = logging.getLogger(__name__)

_DEFINITION = ToolDefinition(
    name="search_jobs",
    description=(
        "Search for jobs and internships personalized to the user's skill stack, "
        "goals, and target role. Returns ranked matches with explanations."
    ),
    input_schema={
        "role": {"type": "string", "description": "Target job title or role."},
        "location": {"type": "string", "description": "Preferred location or 'remote'."},
        "stipend": {"type": "string", "description": "Salary/stipend expectation."},
    },
    timeout_seconds=30,
    tags=["jobs", "career", "internship", "search"],
)


async def _handle_search_jobs(
    role: str = "",
    location: str = "remote",
    stipend: str = "",
    user_context: Dict[str, Any] = None,
    **kwargs,
) -> Dict[str, Any]:
    from backend.mcp.adapters.jobs import search_remotive
    from backend.services.llm import get_llm_service

    profile = user_context or {}
    skills = profile.get("skills", [])
    goals = profile.get("goals", [])
    name = profile.get("name", "the user")

    # If role not explicitly given, infer from profile
    if not role and skills:
        role = _infer_role_from_skills(skills)

    # Fetch live jobs
    jobs = await search_remotive(role=role, tags=skills, max_results=8)

    # Use LLM to explain and rank matches
    llm = get_llm_service()

    jobs_text = "\n".join([
        f"- {j['title']} at {j['company']} | Location: {j['location']} | Salary: {j['salary']} | URL: {j['url']}"
        for j in jobs
    ]) if jobs else "No live listings found from Remotive API."

    prompt = f"""You are a career advisor helping {name} find the best job opportunities.

USER PROFILE:
- Skills: {', '.join(skills) if skills else 'Not specified'}
- Goals: {', '.join(goals) if goals else 'Not specified'}
- Target Role: {role or 'Not specified'}
- Location Preference: {location}
- Salary Target: {stipend or 'Not specified'}

LIVE JOB LISTINGS:
{jobs_text}

Based on this profile and the listings:
1. Identify the top 3-5 best matches for this user and explain WHY each one fits.
2. If no perfect matches exist, explain what roles to target and where to find them.
3. Give 2-3 specific next actions to increase job search success.

Return JSON:
{{
    "top_matches": [
        {{
            "title": "<job title>",
            "company": "<company>",
            "why_good_fit": "<specific reason based on their skills>",
            "url": "<job url>",
            "salary": "<salary if known>"
        }}
    ],
    "missing_skills_for_target": ["<skill 1>", "<skill 2>"],
    "next_actions": ["<action 1>", "<action 2>", "<action 3>"],
    "summary": "<2-3 sentence personalized summary>",
    "total_listings_found": {len(jobs)}
}}"""

    raw = llm.generate(prompt=prompt, system_prompt="You are a job search expert. Output only valid JSON.")

    import re, json
    match = re.search(r'\{.*\}', raw, re.DOTALL)
    if match:
        try:
            result = json.loads(match.group())
            result["raw_listings"] = jobs[:5]
            return result
        except json.JSONDecodeError:
            pass

    return {"summary": raw, "raw_listings": jobs[:5]}


def _infer_role_from_skills(skills: List[str]) -> str:
    """Simple heuristic to infer a job role from the user's skills."""
    s = [sk.lower() for sk in skills]
    if any(t in s for t in ["react", "next.js", "nextjs", "vue", "angular", "typescript"]):
        if any(t in s for t in ["node", "fastapi", "django", "flask", "python"]):
            return "Full Stack Developer"
        return "Frontend Developer"
    if any(t in s for t in ["python", "fastapi", "django"]):
        return "Backend Developer"
    if any(t in s for t in ["machine learning", "ml", "ai", "pytorch", "tensorflow"]):
        return "ML Engineer"
    return "Software Engineer"


register_tool(_DEFINITION, _handle_search_jobs)

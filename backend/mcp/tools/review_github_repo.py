"""
review_github_repo MCP Tool.

Fetches a GitHub repository and generates an LLM-powered
architecture + code quality review with hiring value assessment.
"""
import logging
from typing import Any, Dict

from backend.mcp.registry import register_tool
from backend.mcp.schemas import ToolDefinition

logger = logging.getLogger(__name__)

_DEFINITION = ToolDefinition(
    name="review_github_repo",
    description=(
        "Review a GitHub repository: project summary, architecture quality, "
        "tech stack analysis, resume value, and interview talking points."
    ),
    input_schema={
        "repo_url": {"type": "string", "description": "Full GitHub repository URL."},
    },
    requires_auth=True,
    timeout_seconds=40,
    tags=["github", "code", "project", "review"],
)


async def _handle_review_github_repo(
    repo_url: str = "",
    user_context: Dict[str, Any] = None,
    **kwargs,
) -> Dict[str, Any]:
    if not repo_url:
        return {"error": "No GitHub URL provided.", "summary": "Please provide a GitHub repository URL."}

    from backend.mcp.adapters.github import fetch_repo_info
    from backend.config.settings import settings
    from backend.services.llm import get_llm_service

    token = getattr(settings, "GITHUB_TOKEN", None)
    profile = user_context or {}
    name = profile.get("name", "the user")
    user_skills = profile.get("skills", [])

    try:
        repo_data = await fetch_repo_info(repo_url, token=token)
    except Exception as e:
        return {"error": str(e), "summary": f"Could not fetch repository: {e}"}

    prompt = f"""You are a senior software architect and hiring expert.

Analyze this GitHub repository for {name}:

REPO: {repo_data['name']}
Description: {repo_data['description']}
Stars: {repo_data['stars']} | Forks: {repo_data['forks']}
Languages: {', '.join(repo_data['languages'])}
Topics: {', '.join(repo_data['topics'])}

README (first 3000 chars):
{repo_data['readme']}

USER'S SKILL SET: {', '.join(user_skills) if user_skills else 'Unknown'}

Provide a thorough JSON analysis:
{{
    "project_summary": "<2-3 sentence description of what this project does>",
    "tech_stack": ["<tech 1>", "<tech 2>"],
    "architecture_review": "<honest assessment of code structure and design quality>",
    "strengths": ["<strength 1>", "<strength 2>"],
    "improvements": ["<improvement 1>", "<improvement 2>", "<improvement 3>"],
    "resume_value": "<How valuable is this project on a resume? Rate: low/medium/high + why>",
    "hiring_value": "<What kind of jobs does this project qualify the developer for?>",
    "interview_talking_points": ["<point 1>", "<point 2>", "<point 3>"],
    "missing_features": ["<feature that would significantly improve the project>"],
    "summary": "<3-4 sentence verdict for the user>",
    "score": <1-10 overall project quality>
}}

Be specific, brutally honest, and reference actual code/README content."""

    llm = get_llm_service()
    raw = llm.generate(prompt=prompt, system_prompt="You are a code review expert. Output only valid JSON.")

    import re, json
    match = re.search(r'\{.*\}', raw, re.DOTALL)
    if match:
        try:
            result = json.loads(match.group())
            result["repo_name"] = repo_data["name"]
            result["repo_url"] = repo_url
            return result
        except json.JSONDecodeError:
            pass

    return {"summary": raw, "repo_url": repo_url}


register_tool(_DEFINITION, _handle_review_github_repo)

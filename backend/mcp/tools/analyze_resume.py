"""
analyze_resume MCP Tool.

Performs an ATS-style analysis of the user's resume using the LLM,
grounded in the actual uploaded resume content from memory.
"""
import logging
from typing import Any, Dict

from backend.mcp.registry import register_tool
from backend.mcp.schemas import ToolDefinition

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Tool Definition (registered at import time)
# ---------------------------------------------------------------------------
_DEFINITION = ToolDefinition(
    name="analyze_resume",
    description=(
        "Deeply analyze the user's resume for ATS compatibility, section quality, "
        "keyword gaps, strengths, and weaknesses. Gives a score and actionable suggestions."
    ),
    input_schema={
        "job_description": {"type": "string", "description": "Optional target job description for keyword matching."},
    },
    requires_uploaded_file=True,
    timeout_seconds=45,
    tags=["resume", "career", "ats", "review"],
)


# ---------------------------------------------------------------------------
# Tool Handler
# ---------------------------------------------------------------------------
async def _handle_analyze_resume(
    user_context: Dict[str, Any],
    job_description: str = "",
    **kwargs,
) -> Dict[str, Any]:
    """
    Run LLM-powered ATS resume analysis grounded in retrieved memory.
    """
    from backend.services.llm import get_llm_service

    resume_text = user_context.get("memory_summary", "")
    name = user_context.get("name", "the user")
    skills = user_context.get("skills", [])
    projects = user_context.get("projects", [])

    if not resume_text:
        return {
            "error": "No resume content found in memory. Please upload your resume first.",
            "ats_score": None,
            "summary": "Resume not found.",
        }

    jd_section = (
        f"\n\nTARGET JOB DESCRIPTION:\n{job_description}"
        if job_description
        else ""
    )

    prompt = f"""You are an expert ATS (Applicant Tracking System) analyst and senior career coach.

Analyze the following resume for {name} in detail.

RESUME CONTENT:
{resume_text}

KNOWN PROFILE:
- Skills: {', '.join(skills) if skills else 'Unknown'}
- Projects: {', '.join(projects) if projects else 'Unknown'}
{jd_section}

Provide a structured JSON analysis:
{{
    "ats_score": <number 0-100>,
    "overall_verdict": "<one strong sentence summary>",
    "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
    "weaknesses": ["<weakness 1>", "<weakness 2>", "<weakness 3>"],
    "section_scores": {{
        "summary": <0-10>,
        "skills": <0-10>,
        "experience": <0-10>,
        "projects": <0-10>,
        "education": <0-10>,
        "formatting": <0-10>
    }},
    "keyword_gaps": ["<missing keyword 1>", "<missing keyword 2>"],
    "top_improvements": ["<action item 1>", "<action item 2>", "<action item 3>"],
    "summary": "<2-3 sentence personalized verdict referencing actual sections and projects>"
}}

Output only valid JSON. Be brutally honest and specific — reference actual project names and sections."""

    llm = get_llm_service()
    raw = llm.generate(prompt=prompt, system_prompt="You are a precise ATS analyst. Output only valid JSON.")

    import re, json
    match = re.search(r'\{.*\}', raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    return {"summary": raw, "ats_score": None}


# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------
register_tool(_DEFINITION, _handle_analyze_resume)

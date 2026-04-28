"""
MCP Context Builder.

Builds the enriched user context dict that is injected into every tool call.
Combines the user profile, memory summary, and relevant metadata.
"""
from typing import Any, Dict, Optional


def build_user_context(
    user_profile: Optional[Dict[str, Any]],
    memory_summary: Optional[str] = None,
    has_uploaded_documents: bool = False,
) -> Dict[str, Any]:
    """
    Build a structured context dict to pass into each tool call.

    Args:
        user_profile:  The structured profile from the User.profile JSON column.
        memory_summary: A short summary of retrieved memory chunks.
        has_uploaded_documents: Whether the user has any uploaded docs in memory.

    Returns:
        A dict the tool handler can consume for personalization.
    """
    profile = user_profile or {}
    return {
        "name": profile.get("name", ""),
        "goals": profile.get("goals", []),
        "skills": profile.get("skills", []),
        "projects": profile.get("projects", []),
        "current_role": profile.get("current_role", ""),
        "experience_years": profile.get("experience_years", 0),
        "preferences": profile.get("preferences", {}),
        "memory_summary": memory_summary or "",
        "has_uploaded_documents": has_uploaded_documents,
    }

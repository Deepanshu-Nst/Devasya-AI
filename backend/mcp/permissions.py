"""
MCP Permission Guard.

Controls which tools are accessible based on user context.
"""
import logging
from typing import Dict, Any
from backend.mcp.schemas import ToolDefinition, ToolStatus, ToolOutput

logger = logging.getLogger(__name__)

# Display labels for the frontend activity UI
TOOL_DISPLAY_LABELS: Dict[str, str] = {
    "analyze_resume": "Analyzing your resume...",
    "review_github_repo": "Reviewing GitHub repository...",
    "search_jobs": "Searching for jobs & internships...",
    "web_search": "Searching the web...",
    "compare_models": "Comparing AI models...",
}


def check_permission(
    tool_def: ToolDefinition,
    user_context: Dict[str, Any],
) -> ToolOutput | None:
    """
    Check if the user has permission to invoke this tool.

    Returns a ToolOutput with PERMISSION_DENIED if rejected,
    or None if the call is allowed.
    """
    # If tool requires an uploaded file, verify at least one memory exists
    if tool_def.requires_uploaded_file:
        has_docs = user_context.get("has_uploaded_documents", False)
        if not has_docs:
            logger.warning(
                f"[MCP] Permission denied for {tool_def.name}: no uploaded docs"
            )
            return ToolOutput(
                tool_name=tool_def.name,
                status=ToolStatus.PERMISSION_DENIED,
                error=(
                    "This tool requires an uploaded document. "
                    "Please upload your resume or file first."
                ),
            )

    # If tool requires auth (external API keys), check env config
    if tool_def.requires_auth:
        from backend.config.settings import settings
        if tool_def.name == "review_github_repo":
            if not getattr(settings, "GITHUB_TOKEN", None):
                logger.warning(
                    "[MCP] GitHub token not configured; proceeding without auth."
                )
                # Not blocking — GitHub public API works without token at lower rate limit

    return None  # Permission granted


def get_display_label(tool_name: str) -> str:
    return TOOL_DISPLAY_LABELS.get(tool_name, f"Running {tool_name}...")

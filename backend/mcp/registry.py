"""
MCP Tool Registry — Central registry of all available tools.

Each tool entry describes its name, description, input schema,
and the async handler function that executes it.
"""
import logging
from typing import Any, Callable, Dict, Optional
from backend.mcp.schemas import ToolDefinition

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Registry storage
# ---------------------------------------------------------------------------
_TOOL_REGISTRY: Dict[str, Dict[str, Any]] = {}


def register_tool(
    definition: ToolDefinition,
    handler: Callable,
) -> None:
    """Register a tool with its definition and async handler."""
    _TOOL_REGISTRY[definition.name] = {
        "definition": definition,
        "handler": handler,
    }
    logger.info(f"[MCP] Registered tool: {definition.name}")


def get_tool(name: str) -> Optional[Dict[str, Any]]:
    """Retrieve a registered tool by name."""
    return _TOOL_REGISTRY.get(name)


def list_tools() -> Dict[str, ToolDefinition]:
    """Return all registered tool definitions."""
    return {k: v["definition"] for k, v in _TOOL_REGISTRY.items()}


def get_tool_descriptions_for_planner() -> str:
    """
    Return a formatted string of tools for injection into the planner prompt.
    Helps the LLM understand what tools are available.
    """
    lines = []
    for name, entry in _TOOL_REGISTRY.items():
        d: ToolDefinition = entry["definition"]
        lines.append(
            f"- {name}: {d.description} (tags: {', '.join(d.tags)})"
        )
    return "\n".join(lines) if lines else "No tools available."


# ---------------------------------------------------------------------------
# Auto-registration — import all tools so they self-register
# ---------------------------------------------------------------------------
def _auto_register_all_tools() -> None:
    """Import all tool modules so they call register_tool() at import time."""
    try:
        from backend.mcp.tools import analyze_resume  # noqa: F401
    except Exception as e:
        logger.warning(f"[MCP] Could not load analyze_resume: {e}")

    try:
        from backend.mcp.tools import review_github_repo  # noqa: F401
    except Exception as e:
        logger.warning(f"[MCP] Could not load review_github_repo: {e}")

    try:
        from backend.mcp.tools import search_jobs  # noqa: F401
    except Exception as e:
        logger.warning(f"[MCP] Could not load search_jobs: {e}")

    try:
        from backend.mcp.tools import web_search  # noqa: F401
    except Exception as e:
        logger.warning(f"[MCP] Could not load web_search: {e}")

    try:
        from backend.mcp.tools import compare_models  # noqa: F401
    except Exception as e:
        logger.warning(f"[MCP] Could not load compare_models: {e}")

"""
MCP Tool Executor.

Async execution engine that:
1. Validates inputs against the tool schema.
2. Checks permissions.
3. Runs the tool handler with a timeout.
4. Catches errors and logs usage.
5. Returns a structured ToolOutput.
"""
import asyncio
import logging
import time
from typing import Any, Dict, List

from backend.mcp.schemas import ToolCall, ToolOutput, ToolStatus, ToolEvent
from backend.mcp.registry import get_tool
from backend.mcp.permissions import check_permission, get_display_label

logger = logging.getLogger(__name__)


async def _execute_single_tool(
    tool_call: ToolCall,
    user_context: Dict[str, Any],
) -> ToolOutput:
    """Execute a single tool call with timeout and error handling."""
    entry = get_tool(tool_call.tool_name)
    if not entry:
        return ToolOutput(
            tool_name=tool_call.tool_name,
            status=ToolStatus.ERROR,
            error=f"Tool '{tool_call.tool_name}' not found in registry.",
        )

    definition = entry["definition"]
    handler = entry["handler"]

    # Permission check
    denied = check_permission(definition, user_context)
    if denied:
        return denied

    # Merge parameters with user context
    enriched_params = {**tool_call.parameters, "user_context": user_context}

    start_time = time.monotonic()
    try:
        result = await asyncio.wait_for(
            handler(**enriched_params),
            timeout=definition.timeout_seconds,
        )
        duration_ms = (time.monotonic() - start_time) * 1000
        logger.info(
            f"[MCP] Tool '{tool_call.tool_name}' succeeded in {duration_ms:.0f}ms"
        )
        return ToolOutput(
            tool_name=tool_call.tool_name,
            status=ToolStatus.SUCCESS,
            result=result,
            duration_ms=duration_ms,
        )

    except asyncio.TimeoutError:
        duration_ms = (time.monotonic() - start_time) * 1000
        logger.error(
            f"[MCP] Tool '{tool_call.tool_name}' timed out after {definition.timeout_seconds}s"
        )
        return ToolOutput(
            tool_name=tool_call.tool_name,
            status=ToolStatus.TIMEOUT,
            error=f"Tool timed out after {definition.timeout_seconds} seconds.",
            duration_ms=duration_ms,
        )

    except Exception as e:
        duration_ms = (time.monotonic() - start_time) * 1000
        logger.error(f"[MCP] Tool '{tool_call.tool_name}' raised an error: {e}")
        return ToolOutput(
            tool_name=tool_call.tool_name,
            status=ToolStatus.ERROR,
            error=str(e),
            duration_ms=duration_ms,
        )


async def execute_tools(
    tool_calls: List[ToolCall],
    user_context: Dict[str, Any],
) -> tuple[List[ToolOutput], List[ToolEvent]]:
    """
    Execute multiple tool calls in parallel.

    Returns:
        (tool_outputs, tool_events) — results and UI-friendly events.
    """
    if not tool_calls:
        return [], []

    # Run all tools concurrently
    tasks = [_execute_single_tool(tc, user_context) for tc in tool_calls]
    outputs: List[ToolOutput] = await asyncio.gather(*tasks)

    # Build UI events
    events: List[ToolEvent] = [
        ToolEvent(
            tool_name=o.tool_name,
            display_label=get_display_label(o.tool_name),
            status=o.status,
            summary=_summarize_output(o),
        )
        for o in outputs
    ]

    return outputs, events


def _summarize_output(output: ToolOutput) -> str:
    """Create a short human-readable summary of a tool result for the UI."""
    if output.status == ToolStatus.SUCCESS and output.result:
        result = output.result
        if isinstance(result, dict):
            # Try to return a short preview string
            return result.get("summary", result.get("message", "Completed."))
        return "Completed successfully."
    elif output.status == ToolStatus.PERMISSION_DENIED:
        return output.error or "Permission denied."
    elif output.status == ToolStatus.TIMEOUT:
        return "Tool timed out."
    elif output.status == ToolStatus.ERROR:
        return f"Error: {output.error}"
    return ""


def format_tool_outputs_for_reasoner(outputs: List[ToolOutput]) -> str:
    """
    Format all successful tool outputs into a single context block
    that the Reasoner agent can synthesize into a final answer.
    """
    if not outputs:
        return ""

    parts = []
    for out in outputs:
        if out.status == ToolStatus.SUCCESS and out.result:
            header = f"=== TOOL: {out.tool_name.upper()} ==="
            body = (
                out.result
                if isinstance(out.result, str)
                else _dict_to_readable(out.result)
            )
            parts.append(f"{header}\n{body}")
        elif out.status != ToolStatus.SUCCESS:
            parts.append(
                f"=== TOOL: {out.tool_name.upper()} (FAILED) ===\n"
                f"Reason: {out.error or out.status}"
            )

    return "\n\n".join(parts)


def _dict_to_readable(d: dict) -> str:
    """Convert a dict result to human-readable lines."""
    lines = []
    for k, v in d.items():
        if isinstance(v, list):
            lines.append(f"{k.replace('_', ' ').title()}:")
            for item in v:
                lines.append(f"  - {item}")
        else:
            lines.append(f"{k.replace('_', ' ').title()}: {v}")
    return "\n".join(lines)

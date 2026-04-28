"""
MCP API Router — exposes tool registry info and direct tool execution endpoints.
"""
import logging
from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel
from typing import Any, Dict, List, Optional

from backend.api.auth import decode_token
from backend.mcp.registry import list_tools, get_tool
from backend.mcp.schemas import ToolCall

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/mcp", tags=["mcp"])


@router.get("/tools")
def get_available_tools():
    """List all registered MCP tools with their descriptions and schemas."""
    tools = list_tools()
    return {
        "total": len(tools),
        "tools": [
            {
                "name": d.name,
                "description": d.description,
                "tags": d.tags,
                "requires_auth": d.requires_auth,
                "requires_uploaded_file": d.requires_uploaded_file,
                "input_schema": d.input_schema,
            }
            for d in tools.values()
        ],
    }


class DirectToolRequest(BaseModel):
    tool_name: str
    parameters: Dict[str, Any] = {}
    user_profile: Optional[Dict[str, Any]] = None


@router.post("/execute")
async def execute_tool_directly(
    request: DirectToolRequest,
    authorization: str = Header(None),
):
    """
    Directly execute a single MCP tool by name.
    Useful for frontend calling specific tools without a full chat query.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header",
        )

    token = authorization.split("Bearer ")[1]
    user_id = decode_token(token)  # Validates token

    entry = get_tool(request.tool_name)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tool '{request.tool_name}' not found.",
        )

    from backend.mcp.executor import _execute_single_tool
    from backend.mcp.context import build_user_context

    user_ctx = build_user_context(
        user_profile=request.user_profile,
        has_uploaded_documents=True,  # Assume docs may exist for direct calls
    )

    tool_call = ToolCall(
        tool_name=request.tool_name,
        parameters=request.parameters,
        reason="Direct tool invocation from frontend",
    )

    output = await _execute_single_tool(tool_call, user_ctx)
    return {
        "tool_name": output.tool_name,
        "status": output.status,
        "result": output.result,
        "error": output.error,
        "duration_ms": output.duration_ms,
    }

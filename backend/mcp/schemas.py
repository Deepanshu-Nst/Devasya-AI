"""
MCP Pydantic schemas for tool inputs, outputs, calls, and results.
"""
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
from enum import Enum


class ToolStatus(str, Enum):
    SUCCESS = "success"
    ERROR = "error"
    TIMEOUT = "timeout"
    PERMISSION_DENIED = "permission_denied"
    SKIPPED = "skipped"


class ToolInput(BaseModel):
    """Generic input wrapper for a tool call."""
    tool_name: str
    parameters: Dict[str, Any] = Field(default_factory=dict)
    user_context: Optional[Dict[str, Any]] = None  # injected user profile / memory


class ToolOutput(BaseModel):
    """Generic output from a tool execution."""
    tool_name: str
    status: ToolStatus
    result: Optional[Any] = None
    error: Optional[str] = None
    duration_ms: Optional[float] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ToolDefinition(BaseModel):
    """Metadata for a registered tool."""
    name: str
    description: str
    input_schema: Dict[str, Any]
    requires_auth: bool = False
    requires_uploaded_file: bool = False
    timeout_seconds: int = 30
    tags: List[str] = Field(default_factory=list)


class ToolCall(BaseModel):
    """A planned tool invocation from the planner."""
    tool_name: str
    parameters: Dict[str, Any] = Field(default_factory=dict)
    reason: str = ""


class MCPPlan(BaseModel):
    """Full plan output from the planner agent."""
    intent: str
    needs_retrieval: bool = True
    needs_tools: bool = False
    search_queries: List[str] = Field(default_factory=list)
    tool_calls: List[ToolCall] = Field(default_factory=list)
    analysis_type: str = "analysis"
    reasoning: str = ""


class ToolEvent(BaseModel):
    """UI-facing event for tool activity display."""
    tool_name: str
    display_label: str
    status: ToolStatus
    summary: Optional[str] = None

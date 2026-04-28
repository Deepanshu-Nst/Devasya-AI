"""
compare_models MCP Tool.

Compares AI/LLM models based on benchmarks, cost, speed,
and use-case fit. Powered entirely by LLM knowledge.
"""
import logging
from typing import Any, Dict, List

from backend.mcp.registry import register_tool
from backend.mcp.schemas import ToolDefinition

logger = logging.getLogger(__name__)

_DEFINITION = ToolDefinition(
    name="compare_models",
    description=(
        "Compare AI/LLM models (GPT-4, Claude, Gemini, Groq, Mistral, etc.) "
        "on cost, speed, quality, and use-case fit. Returns a structured comparison."
    ),
    input_schema={
        "models": {"type": "array", "items": {"type": "string"}, "description": "List of model names to compare."},
        "use_case": {"type": "string", "description": "Use case context (e.g., coding, summarization, chat)."},
    },
    timeout_seconds=30,
    tags=["ai", "models", "benchmark", "comparison", "llm"],
)


async def _handle_compare_models(
    models: List[str] = None,
    use_case: str = "general",
    user_context: Dict[str, Any] = None,
    **kwargs,
) -> Dict[str, Any]:
    if not models:
        models = ["GPT-4o", "Claude 3.5 Sonnet", "Gemini 1.5 Pro", "Llama 3.3 70B"]

    from backend.services.llm import get_llm_service

    llm = get_llm_service()
    models_str = ", ".join(models)

    prompt = f"""You are an AI systems expert. Compare these models: {models_str}

Use case: {use_case}

Based on your knowledge up to your training cutoff, provide a structured comparison:
{{
    "comparison_table": [
        {{
            "model": "<model name>",
            "provider": "<company>",
            "best_for": "<primary use case>",
            "speed": "<fast/medium/slow>",
            "cost": "<$/1M tokens or relative cost>",
            "context_window": "<tokens>",
            "strengths": ["<strength 1>", "<strength 2>"],
            "weaknesses": ["<weakness 1>"]
        }}
    ],
    "recommendation": "<Which model to use for the given use case and why>",
    "for_your_use_case": "<Specific advice for: {use_case}>",
    "summary": "<2-3 sentence verdict>"
}}

Be accurate, specific, and reference real benchmark data where known."""

    raw = llm.generate(prompt=prompt, system_prompt="You are an AI benchmark expert. Output only valid JSON.")

    import re, json
    match = re.search(r'\{.*\}', raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    return {"summary": raw, "models_compared": models}


register_tool(_DEFINITION, _handle_compare_models)

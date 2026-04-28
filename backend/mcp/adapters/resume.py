"""
Resume adapter — provides resume text extraction from user memory/uploads.
"""
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def get_resume_text_from_memory(memory_chunks: list) -> str:
    """
    Combine resume memory chunks into a single resume text block.
    Filters chunks that appear to be from uploaded resume documents.
    """
    resume_parts = []
    for chunk in memory_chunks:
        if isinstance(chunk, dict):
            meta = chunk.get("metadata", {}) or {}
            content = chunk.get("content", "")
            # Heuristic: include chunks sourced from document uploads
            source = str(meta.get("source", "")).lower()
            mem_type = str(meta.get("type", "")).lower()
            if "resume" in source or "cv" in source or mem_type == "document":
                resume_parts.append(content)
            elif content:
                resume_parts.append(content)

    return "\n\n".join(resume_parts) if resume_parts else ""

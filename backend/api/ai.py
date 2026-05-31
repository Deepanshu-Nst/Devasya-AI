import logging
import uuid
import json
import asyncio
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from backend.db.postgres import get_db
from backend.models.schema import Profile, InlineQueryRequest
from backend.api.auth import get_current_user
from backend.services.llm import LLMService
import time
from collections import defaultdict
import hashlib

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["ai"])

# Simple in-memory rate limiter (15 requests per minute per user)
user_rate_limits = defaultdict(list)

# Simple in-memory cache for exact identical prompts
generation_cache = {}

@router.post("/inline")
async def inline_generation(
    request: Request,
    query_req: InlineQueryRequest,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lightweight inline AI generation supporting SSE streaming.
    Supports AbortController via request.is_disconnected().
    """
    user_id = str(current_user.id)
    now = time.time()
    
    # Rate limiting
    user_rate_limits[user_id] = [t for t in user_rate_limits[user_id] if now - t < 60]
    if len(user_rate_limits[user_id]) >= 15:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Please wait a minute.")
    user_rate_limits[user_id].append(now)
    
    logger.info(f"Inline AI requested: action={query_req.action} by user {current_user.id}")
    
    # 1. Action-to-Prompt mapping
    if query_req.action == "summarize":
        system_prompt = "You are a helpful AI assistant. Summarize the provided context concisely. Return plain markdown text."
    elif query_req.action == "extract_tasks":
        system_prompt = "You are a helpful AI assistant. Extract action items from the context. Return ONLY a JSON object in the format: {\"tasks\": [{\"title\": \"Task 1\", \"priority\": \"medium\", \"status\": \"Todo\"}]}"
    elif query_req.action == "rewrite":
        system_prompt = "You are a helpful AI assistant. Rewrite the provided text to improve clarity, grammar, and flow. Return plain markdown text."
    elif query_req.action == "improve_clarity":
        system_prompt = "You are a helpful AI assistant. Improve the clarity and grammar of the provided text. Return plain markdown text."
    elif query_req.action == "continue_writing":
        system_prompt = "You are a helpful AI assistant. Continue writing the text logically based on the provided context. Return plain markdown text."
    else:
        system_prompt = "You are a helpful AI assistant."
    
    # 2. Context assembly
    context_str = ""
    if query_req.context_blocks:
        context_str = "\n\n".join(query_req.context_blocks)
        
    user_prompt = ""
    if query_req.prompt:
        user_prompt += f"Instructions: {query_req.prompt}\n\n"
    if context_str:
        user_prompt += f"Context:\n{context_str}"
        
    if not user_prompt.strip():
        user_prompt = "Please assist."
        
    # Check cache
    cache_key_str = f"{query_req.action}_{system_prompt}_{user_prompt}"
    cache_key = hashlib.md5(cache_key_str.encode('utf-8')).hexdigest()
    
    if cache_key in generation_cache:
        logger.info(f"Returning cached inline generation for {cache_key}")
        async def cached_stream():
            yield f"data: {json.dumps({'text': generation_cache[cache_key]})}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(cached_stream(), media_type="text/event-stream")
        
    llm = LLMService()
    
    async def generate():
        try:
            generator = llm.async_stream_completion(
                system_prompt=system_prompt,
                prompt=user_prompt
            )
            full_response = ""
            async for chunk in generator:
                # Check for client disconnect
                if await request.is_disconnected():
                    logger.info("Client disconnected, aborting generation.")
                    break
                
                # yield SSE format
                if chunk:
                    full_response += chunk
                    yield f"data: {json.dumps({'text': chunk})}\n\n"
            
            # Save to cache
            if not await request.is_disconnected() and full_response:
                generation_cache[cache_key] = full_response
                
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error(f"Error in inline AI stream: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            
    return StreamingResponse(generate(), media_type="text/event-stream")

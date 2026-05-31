"""
LLM service for AI generation using OpenAI or Groq.
"""
import logging
from typing import Optional

from backend.config.settings import settings

logger = logging.getLogger(__name__)


class LLMService:
    """Service for interacting with LLM providers."""
    
    def __init__(self):
        """Initialize LLM service (Forced Groq)."""
        if not settings.GROQ_API_KEY:
            logger.warning("GROQ_API_KEY is missing! LLM calls will fail.")
            
        from langchain_groq import ChatGroq
        self.llm = ChatGroq(
            api_key=settings.GROQ_API_KEY,
            model=settings.GROQ_MODEL,
            temperature=0.7,
        )
        logger.info(f"Groq LLM initialized: {settings.GROQ_MODEL}")
    
    def generate(
        self,
        prompt: Optional[str] = None,
        system_prompt: Optional[str] = None,
        max_tokens: int = 1000,
        messages_list: Optional[list] = None
    ) -> str:
        """
        Generate response from LLM (synchronous, blocking).
        Use async_generate() when calling from an async context.
        """
        try:
            from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
            
            messages = []
            if messages_list:
                for msg in messages_list:
                    if msg.get("role") == "system":
                        messages.append(SystemMessage(content=msg.get("content", "")))
                    elif msg.get("role") == "assistant":
                        messages.append(AIMessage(content=msg.get("content", "")))
                    else:
                        messages.append(HumanMessage(content=msg.get("content", "")))
            else:
                if system_prompt:
                    messages.append(SystemMessage(content=system_prompt))
                if prompt:
                    messages.append(HumanMessage(content=prompt))
            
            response = self.llm.invoke(messages)
            return response.content
        except Exception as e:
            logger.error(f"Error generating response: {e}")
            raise

    async def async_generate(
        self,
        prompt: Optional[str] = None,
        system_prompt: Optional[str] = None,
        max_tokens: int = 1000,
        messages_list: Optional[list] = None
    ) -> str:
        """
        Generate response from LLM asynchronously.
        Runs the blocking LLM call in a thread pool to avoid blocking the event loop.
        """
        import asyncio
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self.generate(
                prompt=prompt,
                system_prompt=system_prompt,
                max_tokens=max_tokens,
                messages_list=messages_list,
            )
        )
    
    async def async_stream_completion(
        self,
        prompt: Optional[str] = None,
        system_prompt: Optional[str] = None,
        messages_list: Optional[list] = None
    ):
        """
        Stream response from LLM asynchronously.
        """
        from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
        
        messages = []
        if messages_list:
            for msg in messages_list:
                if msg.get("role") == "system":
                    messages.append(SystemMessage(content=msg.get("content", "")))
                elif msg.get("role") == "assistant":
                    messages.append(AIMessage(content=msg.get("content", "")))
                else:
                    messages.append(HumanMessage(content=msg.get("content", "")))
        else:
            if system_prompt:
                messages.append(SystemMessage(content=system_prompt))
            if prompt:
                messages.append(HumanMessage(content=prompt))
        
        try:
            async for chunk in self.llm.astream(messages):
                yield chunk.content
        except Exception as e:
            logger.error(f"Error streaming response: {e}")
            raise

    def generate_structured(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        response_format: Optional[dict] = None
    ) -> dict:
        """
        Generate structured response from LLM.
        
        Args:
            prompt: User prompt
            system_prompt: System instructions
            response_format: Expected response format schema
            
        Returns:
            Structured response as dict
        """
        try:
            response_text = self.generate(prompt, system_prompt)
            
            # Parse JSON response
            import json
            import re
            
            # Try to extract JSON from response
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            else:
                # If no JSON found, return raw text
                return {"content": response_text}
        except Exception as e:
            logger.error(f"Error generating structured response: {e}")
            return {"error": str(e)}


# Global LLM service instance
_llm_service = None


def init_llm_service():
    """Initialize LLM service."""
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service


def get_llm_service() -> LLMService:
    """Get LLM service instance."""
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service

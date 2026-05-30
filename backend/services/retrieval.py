"""
Retrieval service for RAG pipeline.
"""
import logging
from typing import List, Dict, Any
import uuid

from backend.db.vector_store import get_vector_store

logger = logging.getLogger(__name__)


class RetrievalService:
    """Service for retrieving relevant context from memory using pgvector."""
    
    def __init__(self):
        """Initialize retrieval service."""
        self.vector_store = get_vector_store()
    
    def retrieve_context(
        self,
        workspace_id: uuid.UUID,
        query: str,
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Retrieve relevant documents from user's workspace.
        
        Args:
            workspace_id: User Workspace ID
            query: Query text
            top_k: Number of documents to retrieve
            
        Returns:
            List of relevant documents with metadata
        """
        try:
            # Search in vector store (now pgvector)
            results = self.vector_store.search(
                workspace_id=workspace_id,
                query=query,
                top_k=top_k
            )
            
            logger.info(f"Retrieved {len(results)} documents for workspace {workspace_id}")
            return results
        except Exception as e:
            logger.error(f"Error retrieving context: {e}")
            return []
    
    def format_context(
        self,
        documents: List[Dict[str, Any]],
        max_context_length: int = 2000
    ) -> str:
        """
        Format retrieved documents into context string.
        
        Args:
            documents: Retrieved documents
            max_context_length: Maximum context length
            
        Returns:
            Formatted context string
        """
        if not documents:
            return "No relevant context found in memory."
        
        context_parts = []
        total_length = 0
        
        for doc in documents:
            content = doc.get("content", "")
            
            # Add context header
            part = f"- {content}\n"
            
            if total_length + len(part) <= max_context_length:
                context_parts.append(part)
                total_length += len(part)
            else:
                break
        
        return "\n".join(context_parts) if context_parts else "No relevant context found."


# Global retrieval service instance
_retrieval_service = None


def init_retrieval_service():
    """Initialize retrieval service."""
    global _retrieval_service
    if _retrieval_service is None:
        _retrieval_service = RetrievalService()
    return _retrieval_service


def get_retrieval_service() -> RetrievalService:
    """Get retrieval service instance."""
    global _retrieval_service
    if _retrieval_service is None:
        _retrieval_service = RetrievalService()
    return _retrieval_service

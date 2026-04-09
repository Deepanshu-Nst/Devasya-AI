"""
Retrieval service for RAG pipeline.
"""
import logging
from typing import List, Dict

from backend.db.vector_store import get_vector_store
from backend.services.embedding import get_embedding_service

logger = logging.getLogger(__name__)


class RetrievalService:
    """Service for retrieving relevant context from memory."""
    
    def __init__(self):
        """Initialize retrieval service."""
        self.vector_store = get_vector_store()
        self.embedding_service = get_embedding_service()
    
    def retrieve_context(
        self,
        user_id: int,
        query: str,
        top_k: int = 5
    ) -> List[Dict[str, str]]:
        """
        Retrieve relevant documents from user's memory.
        
        Args:
            user_id: User ID
            query: Query text
            top_k: Number of documents to retrieve
            
        Returns:
            List of relevant documents with metadata
        """
        try:
            # Search in vector store
            results = self.vector_store.search(
                user_id=user_id,
                query=query,
                top_k=top_k
            )
            
            logger.info(f"Retrieved {len(results)} documents for user {user_id}")
            return results
        except Exception as e:
            logger.error(f"Error retrieving context: {e}")
            return []
    
    def format_context(
        self,
        documents: List[Dict[str, str]],
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
            relevance = 1 - doc.get("distance", 0)  # Convert distance to relevance
            
            # Add context header
            part = f"[Relevance: {relevance:.2f}]\n{content}\n"
            
            if total_length + len(part) <= max_context_length:
                context_parts.append(part)
                total_length += len(part)
            else:
                break
        
        return "\n".join(context_parts) if context_parts else "No relevant context found."
    
    def rank_documents(
        self,
        documents: List[Dict[str, str]],
        query: str
    ) -> List[Dict[str, str]]:
        """
        Rank documents by relevance to query.
        
        Args:
            documents: Documents to rank
            query: Query for ranking
            
        Returns:
            Sorted documents by relevance
        """
        # Documents are already ranked by vector similarity from ChromaDB
        # Additional ranking can be applied here if needed
        return sorted(
            documents,
            key=lambda x: x.get("distance", float('inf'))
        )


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

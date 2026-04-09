"""
ChromaDB vector database handler for semantic search and RAG.
"""
from chromadb import PersistentClient
import logging
from typing import Optional, List

from backend.config.settings import settings

logger = logging.getLogger(__name__)


class VectorStore:
    """Wrapper for ChromaDB vector database operations."""
    
    def __init__(self):
        try:
            # ✅ NEW Chroma client (modern API)
            self.client = PersistentClient(path=settings.CHROMA_PATH)

            self.collection_name = "devasya_memories"

            # Get or create collection
            self.collection = self.client.get_or_create_collection(
                name=self.collection_name,
                metadata={
                    "hnsw:space": "cosine",
                    "description": "Devasya AI memory embeddings"
                }
            )

            logger.info("ChromaDB initialized successfully")

        except Exception as e:
            logger.error(f"Error initializing ChromaDB: {e}")
            raise
    
    def add_document(
        self,
        user_id: int,
        content: str,
        document_id: str,
        metadata: Optional[dict] = None
    ) -> str:
        """
        Add a document to the vector store.
        
        Args:
            user_id: User ID for filtering
            content: Document content to embed and store
            document_id: Unique document ID
            metadata: Additional metadata
            
        Returns:
            Document ID in the vector store
        """
        try:
            doc_metadata = metadata or {}
            doc_metadata["user_id"] = str(user_id)
            
            self.collection.add(
                ids=[document_id],
                documents=[content],
                metadatas=[doc_metadata],
            )
            
            logger.info(f"Document {document_id} added for user {user_id}")
            return document_id
        except Exception as e:
            logger.error(f"Error adding document: {e}")
            raise
    
    def search(
        self,
        user_id: int,
        query: str,
        top_k: int = 5
    ) -> List[dict]:
        """
        Search for relevant documents using semantic similarity.
        
        Args:
            user_id: User ID to filter results
            query: Query text to embed
            top_k: Number of top results to return
            
        Returns:
            List of relevant documents with metadata
        """
        try:
            # Query the collection
            results = self.collection.query(
                query_texts=[query],
                n_results=top_k,
                where={"user_id": {"$eq": str(user_id)}},
            )
            
            # Format results
            documents = []
            if results and results["documents"] and len(results["documents"]) > 0:
                for i, doc in enumerate(results["documents"][0]):
                    documents.append({
                        "content": doc,
                        "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                        "distance": results["distances"][0][i] if results["distances"] else 0,
                        "id": results["ids"][0][i] if results["ids"] else None,
                    })
            
            return documents
        except Exception as e:
            logger.error(f"Error searching documents: {e}")
            return []
    
    def delete_document(self, document_id: str) -> bool:
        """
        Delete a document from the vector store.
        
        Args:
            document_id: Document ID to delete
            
        Returns:
            True if successful, False otherwise
        """
        try:
            self.collection.delete(ids=[document_id])
            logger.info(f"Document {document_id} deleted")
            return True
        except Exception as e:
            logger.error(f"Error deleting document: {e}")
            return False
    
    def get_stats(self) -> dict:
        """Get vector store statistics."""
        try:
            count = self.collection.count()
            return {
                "collection_name": self.collection_name,
                "document_count": count,
            }
        except Exception as e:
            logger.error(f"Error getting stats: {e}")
            return {}


# Global vector store instance
_vector_store: Optional[VectorStore] = None


def init_vector_store() -> VectorStore:
    """Initialize and return global vector store instance."""
    global _vector_store
    if _vector_store is None:
        _vector_store = VectorStore()
    return _vector_store


def get_vector_store() -> VectorStore:
    """Get global vector store instance."""
    global _vector_store
    if _vector_store is None:
        _vector_store = VectorStore()
    return _vector_store

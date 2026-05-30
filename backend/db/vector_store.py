"""
Supabase pgvector handler for semantic search and RAG.
Replaces legacy ChromaDB to stabilize Render builds.
"""
import logging
from typing import List, Dict, Any, Optional
import uuid
from openai import OpenAI

from backend.config.settings import settings
from backend.db.postgres import get_db
from backend.models.schema import DocumentChunk, Document, MemoryPage

logger = logging.getLogger(__name__)

class VectorStore:
    """Wrapper for pgvector operations using OpenAI embeddings."""
    
    def __init__(self):
        try:
            self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
            logger.info("OpenAI and pgvector initialized successfully")
        except Exception as e:
            logger.error(f"Error initializing VectorStore: {e}")
            raise
    
    def _get_embedding(self, text: str) -> List[float]:
        """Generate embedding for text using OpenAI."""
        response = self.client.embeddings.create(
            input=text,
            model="text-embedding-3-small"
        )
        return response.data[0].embedding
        
    def add_chunks(self, chunks: List[str], document_id: Optional[uuid.UUID] = None, memory_id: Optional[uuid.UUID] = None) -> List[uuid.UUID]:
        """Embed and store chunks in Postgres pgvector."""
        if not document_id and not memory_id:
            raise ValueError("Must provide either document_id or memory_id")
            
        chunk_ids = []
        try:
            # We must use a separate database session context here
            db = next(get_db())
            
            for i, text in enumerate(chunks):
                embedding = self._get_embedding(text)
                new_chunk = DocumentChunk(
                    document_id=document_id,
                    memory_id=memory_id,
                    content=text,
                    chunk_index=i,
                    embedding=embedding
                )
                db.add(new_chunk)
                db.commit()
                db.refresh(new_chunk)
                chunk_ids.append(new_chunk.id)
                
            db.close()
            logger.info(f"Added {len(chunk_ids)} chunks to pgvector.")
            return chunk_ids
        except Exception as e:
            logger.error(f"Error adding vector chunks: {e}")
            raise

    def search(self, workspace_id: uuid.UUID, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Search for relevant chunks using pgvector cosine distance operator (<=>).
        """
        try:
            query_embedding = self._get_embedding(query)
            
            db = next(get_db())
            
            # Find the top_k chunks that belong to this workspace
            # We join Document and MemoryPage to verify workspace ownership
            
            results = db.query(DocumentChunk).outerjoin(
                Document, DocumentChunk.document_id == Document.id
            ).outerjoin(
                MemoryPage, DocumentChunk.memory_id == MemoryPage.id
            ).filter(
                (Document.workspace_id == workspace_id) | (MemoryPage.workspace_id == workspace_id)
            ).order_by(
                DocumentChunk.embedding.cosine_distance(query_embedding)
            ).limit(top_k).all()
            
            formatted_results = []
            for chunk in results:
                formatted_results.append({
                    "id": chunk.id,
                    "content": chunk.content,
                    "metadata": {
                        "document_id": str(chunk.document_id) if chunk.document_id else None,
                        "memory_id": str(chunk.memory_id) if chunk.memory_id else None,
                        "chunk_index": chunk.chunk_index
                    }
                })
                
            db.close()
            return formatted_results
        except Exception as e:
            logger.error(f"Error searching vectors: {e}")
            return []


# Global vector store instance
_vector_store = None

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

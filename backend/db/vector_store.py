"""
Supabase pgvector handler for semantic search and RAG.
Replaces legacy ChromaDB to stabilize Render builds.

Embedding strategy (priority order):
  1. HuggingFace Inference API (free, no key needed, but can be rate-limited)
  2. Zero-vector fallback — content is ALWAYS saved; vector search degrades gracefully
     This ensures uploads/saves NEVER fail due to embedding provider outages.
"""
import logging
import time
from typing import List, Dict, Any, Optional
import uuid

from backend.config.settings import settings
from backend.db.postgres import get_db
from backend.models.schema import DocumentChunk, Document, Block

logger = logging.getLogger(__name__)

# HuggingFace model dimensions: 384 → padded to 1536 to match existing pgvector schema
EMBEDDING_DIM = 1536
HF_API_URL = "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2"


class VectorStore:
    """Wrapper for pgvector operations using HuggingFace embeddings (with zero-vector fallback)."""

    def __init__(self):
        logger.info("VectorStore initialized (HuggingFace API with zero-vector fallback)")

    def _get_embedding(self, text: str) -> List[float]:
        """
        Generate embedding via HuggingFace Inference API.
        Falls back to a zero vector if the API is unreachable (e.g., DNS failure on Render).
        Content is ALWAYS saved — search quality degrades gracefully instead of blocking writes.
        """
        import requests

        headers = {}
        if settings.HUGGINGFACE_API_KEY:
            headers["Authorization"] = f"Bearer {settings.HUGGINGFACE_API_KEY}"

        for attempt in range(2):
            try:
                response = requests.post(
                    HF_API_URL,
                    headers=headers,
                    json={"inputs": [text[:512]]},  # Truncate to avoid input-too-long errors
                    timeout=8,
                )
                if response.status_code == 200:
                    result = response.json()
                    embedding = result[0] if isinstance(result[0], list) else result
                    # Pad or trim to EMBEDDING_DIM
                    if len(embedding) < EMBEDDING_DIM:
                        embedding = embedding + [0.0] * (EMBEDDING_DIM - len(embedding))
                    elif len(embedding) > EMBEDDING_DIM:
                        embedding = embedding[:EMBEDDING_DIM]
                    return embedding
                logger.warning(f"HuggingFace API returned {response.status_code} on attempt {attempt + 1}")
                time.sleep(1)
            except Exception as e:
                logger.warning(f"HuggingFace embedding attempt {attempt + 1} failed: {type(e).__name__}: {e}")
                if attempt < 1:
                    time.sleep(1)

        # ── Zero-vector fallback ──────────────────────────────────────────────
        # Content is still stored in the DB; similarity search will not return
        # these chunks, but the text is searchable via SQL LIKE if needed.
        logger.warning(
            "HuggingFace API unavailable. Storing content with zero-vector. "
            "Semantic search for this item is degraded until embeddings are regenerated."
        )
        return [0.0] * EMBEDDING_DIM

    def add_chunks(
        self,
        chunks: List[str],
        document_id: Optional[uuid.UUID] = None,
        block_id: Optional[uuid.UUID] = None,
    ) -> List[uuid.UUID]:
        """Embed and store chunks in Postgres pgvector. Embedding failures use zero-vector fallback."""
        if not document_id and not block_id:
            raise ValueError("Must provide either document_id or block_id")

        chunk_ids = []
        db = next(get_db())
        try:
            for i, text in enumerate(chunks):
                # Each chunk gets its own embedding — individual chunk failures don't abort others
                try:
                    embedding = self._get_embedding(text)
                except Exception as embed_err:
                    logger.warning(f"Embedding failed for chunk {i} — using zero vector: {embed_err}")
                    embedding = [0.0] * EMBEDDING_DIM

                new_chunk = DocumentChunk(
                    document_id=document_id,
                    block_id=block_id,
                    content=text,
                    chunk_index=i,
                    embedding=embedding,
                )
                db.add(new_chunk)
                db.commit()
                db.refresh(new_chunk)
                chunk_ids.append(new_chunk.id)

            logger.info(f"Stored {len(chunk_ids)} chunks in pgvector.")
            return chunk_ids
        except Exception as e:
            logger.error(f"Error storing vector chunks: {e}")
            raise
        finally:
            db.close()

    def search(self, workspace_id: uuid.UUID, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Search for relevant chunks using pgvector cosine distance.
        Returns empty list on any failure — never blocks the query pipeline.
        """
        db = next(get_db())
        try:
            query_embedding = self._get_embedding(query)

            results = (
                db.query(DocumentChunk)
                .outerjoin(Document, DocumentChunk.document_id == Document.id)
                .outerjoin(Block, DocumentChunk.block_id == Block.id)
                .filter(
                    (Document.workspace_id == workspace_id)
                    | (Block.workspace_id == workspace_id)
                )
                .order_by(DocumentChunk.embedding.cosine_distance(query_embedding))
                .limit(top_k)
                .all()
            )

            formatted = []
            for chunk in results:
                formatted.append(
                    {
                        "id": str(chunk.id),
                        "content": chunk.content,
                        "metadata": {
                            "document_id": str(chunk.document_id) if chunk.document_id else None,
                            "block_id": str(chunk.block_id) if chunk.block_id else None,
                            "chunk_index": chunk.chunk_index,
                        },
                    }
                )
            return formatted
        except Exception as e:
            logger.error(f"Vector search failed (non-fatal): {e}")
            return []
        finally:
            db.close()


# Global instance
_vector_store = None


def init_vector_store() -> VectorStore:
    global _vector_store
    if _vector_store is None:
        _vector_store = VectorStore()
    return _vector_store


def get_vector_store() -> VectorStore:
    global _vector_store
    if _vector_store is None:
        _vector_store = VectorStore()
    return _vector_store

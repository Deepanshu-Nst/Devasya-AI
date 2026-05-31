"""
Memory management endpoints for Devasya AI.
Now uses Supabase storage, pgvector, and new SQLAlchemy schema.
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
import logging
import uuid
import os
from supabase import create_client, Client

from backend.config.settings import settings
from backend.db.postgres import get_db, SessionLocal
from backend.db.vector_store import get_vector_store
from backend.models.schema import MemoryPage, Document, Profile, Workspace, MemoryCreate, MemoryResponse, DocumentChunk
from backend.api.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/memory", tags=["memory"])

# Initialize Supabase client for storage operations
# We use SERVICE_ROLE_KEY here to bypass RLS for server-side uploads.
# Falls back to ANON_KEY if service role key is not configured.
_supabase_key = settings.SUPABASE_SERVICE_ROLE_KEY or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or settings.SUPABASE_ANON_KEY
supabase: Client = create_client(
    settings.SUPABASE_URL,
    _supabase_key
)

# ─────────────────────────────────────────────────────────────────────────────
# SERIALIZATION HELPERS
# These convert ORM objects to plain Python dicts WHILE the DB session is open,
# avoiding SQLAlchemy 2.0 lazy-load failures on detached objects.
# We do NOT use Pydantic ORM mode / from_orm / model_validate here because
# those can fail when the session closes before serialization completes.
# ─────────────────────────────────────────────────────────────────────────────

def _serialize_memory(m: MemoryPage) -> dict:
    """Convert a MemoryPage ORM object to a plain dict for JSON response."""
    return {
        "id": str(m.id),
        "workspace_id": str(m.workspace_id),
        "title": m.title,
        "content": m.content,
        "visibility": m.visibility or "private",
        "created_at": m.created_at.isoformat() if m.created_at else None,
        "meta_data": None,
    }


def _serialize_document(doc: Document) -> dict:
    """Convert a Document ORM object to a list-compatible dict for JSON response."""
    return {
        "id": str(doc.id),
        "workspace_id": str(doc.workspace_id),
        "title": doc.file_name,
        "content": f"Document: {doc.file_name}",
        "visibility": "private",
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
        "meta_data": {
            "type": "document",
            "source": doc.file_name,
            "status": doc.embedding_status,
            "file_type": doc.file_type,
            "file_size": doc.file_size,
            "file_url": doc.file_url,
        },
    }


def get_user_workspace(db: Session, user_id: uuid.UUID) -> uuid.UUID:
    """Helper to get or create the default workspace for a user."""
    workspace = db.query(Workspace).filter(Workspace.owner_id == user_id).first()
    if not workspace:
        workspace = Workspace(owner_id=user_id, name="Personal Workspace")
        db.add(workspace)
        db.commit()
        db.refresh(workspace)
    return workspace.id


def _embed_memory_background(memory_id: uuid.UUID, content: str):
    """Background task to generate embeddings for a memory page without blocking the HTTP response."""
    try:
        from backend.services.document_parser import chunk_text
        chunks = chunk_text(content, chunk_size=1000, overlap=100)
        vector_store = get_vector_store()
        
        # We need a fresh DB session for the background task if we need to interact with DB,
        # but add_chunks manages its own session internally via next(get_db()), so this is safe.
        vector_store.add_chunks(
            chunks=chunks if chunks else [content],
            memory_id=memory_id
        )
        logger.info(f"Background embedding completed for memory {memory_id}")
    except Exception as embed_err:
        logger.warning(f"Background embedding failed for memory {memory_id}: {embed_err}")


@router.post("/add")
def add_memory(
    memory_data: MemoryCreate,
    background_tasks: BackgroundTasks,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a new memory page to user's knowledge base."""
    user_id = current_user.id
    workspace_id = get_user_workspace(db, user_id)

    try:
        new_memory = MemoryPage(
            workspace_id=workspace_id,
            created_by=user_id,
            content=memory_data.content,
            title=memory_data.title,
            visibility=memory_data.visibility or "private"
        )
        db.add(new_memory)
        db.commit()
        db.refresh(new_memory)

        # Serialize immediately while session is still open
        result = _serialize_memory(new_memory)

        # Embed in the background so the UI feels instant
        background_tasks.add_task(_embed_memory_background, new_memory.id, memory_data.content)

        return result

    except Exception as e:
        db.rollback()
        import traceback
        logger.error(f"Error adding memory: {e}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error adding memory: {str(e)}"
        )


@router.get("/list")
def list_memories(
    skip: int = 0,
    limit: int = 100,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List user's memory pages AND uploaded documents with pagination."""
    user_id = current_user.id

    try:
        # Get all workspace IDs owned by this user
        workspace_ids = [
            row[0]
            for row in db.query(Workspace.id).filter(Workspace.owner_id == user_id).all()
        ]

        if not workspace_ids:
            return {"total": 0, "skip": skip, "limit": limit, "memories": []}

        # ── 1. Memory Pages (text notes) ──────────────────────────────────────
        memory_pages = db.query(MemoryPage).filter(
            MemoryPage.workspace_id.in_(workspace_ids)
        ).order_by(MemoryPage.created_at.desc()).all()

        # Serialize INSIDE the session (while attributes are accessible)
        items = [_serialize_memory(m) for m in memory_pages]

        # ── 2. Uploaded Documents ─────────────────────────────────────────────
        # Documents live in the `documents` table — they would be invisible to
        # the list endpoint unless we explicitly query them here.
        documents = db.query(Document).filter(
            Document.workspace_id.in_(workspace_ids)
        ).order_by(Document.created_at.desc()).all()

        items.extend([_serialize_document(doc) for doc in documents])

        # Sort combined list by created_at (newest first)
        items.sort(key=lambda x: x["created_at"] or "", reverse=True)

        total = len(items)
        paginated = items[skip: skip + limit]

        logger.info(f"Listed {len(memory_pages)} notes + {len(documents)} docs for user {user_id}")

        return {
            "total": total,
            "skip": skip,
            "limit": limit,
            "memories": paginated,
        }

    except Exception as e:
        import traceback
        logger.error(f"Error listing memories: {e}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing memories: {str(e)}"
        )


@router.get("/{memory_id}")
def get_memory(
    memory_id: str,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific memory page."""
    user_id = current_user.id

    try:
        mem_uuid = uuid.UUID(memory_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid memory ID")

    workspace_ids = [
        row[0]
        for row in db.query(Workspace.id).filter(Workspace.owner_id == user_id).all()
    ]

    memory = db.query(MemoryPage).filter(
        MemoryPage.id == mem_uuid,
        MemoryPage.workspace_id.in_(workspace_ids)
    ).first()

    if not memory:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found")

    return _serialize_memory(memory)


@router.put("/{memory_id}")
def update_memory(
    memory_id: str,
    memory_update: MemoryCreate,
    background_tasks: BackgroundTasks,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Edit memory content."""
    user_id = current_user.id

    try:
        mem_uuid = uuid.UUID(memory_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid memory ID")

    workspace_ids = [
        row[0]
        for row in db.query(Workspace.id).filter(Workspace.owner_id == user_id).all()
    ]

    memory = db.query(MemoryPage).filter(
        MemoryPage.id == mem_uuid,
        MemoryPage.workspace_id.in_(workspace_ids)
    ).first()

    if not memory:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found")

    try:
        memory.content = memory_update.content
        if memory_update.title is not None:
            memory.title = memory_update.title
        if memory_update.visibility:
            memory.visibility = memory_update.visibility

        db.commit()
        db.refresh(memory)

        # Serialize immediately
        result = _serialize_memory(memory)

        # Re-embed in the background
        # First delete old chunks, then trigger background task
        try:
            db.query(DocumentChunk).filter(DocumentChunk.memory_id == memory.id).delete()
            db.commit()
            background_tasks.add_task(_embed_memory_background, memory.id, memory_update.content)
        except Exception as embed_err:
            logger.warning(f"Failed to clear/queue re-embedding for memory {memory.id}: {embed_err}")

        return result

    except Exception as e:
        db.rollback()
        logger.error(f"Error updating memory: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating memory: {str(e)}"
        )


@router.delete("/{memory_id}")
def delete_memory(
    memory_id: str,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a memory page."""
    user_id = current_user.id

    try:
        mem_uuid = uuid.UUID(memory_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid memory ID")

    workspace_ids = [
        row[0]
        for row in db.query(Workspace.id).filter(Workspace.owner_id == user_id).all()
    ]

    memory = db.query(MemoryPage).filter(
        MemoryPage.id == mem_uuid,
        MemoryPage.workspace_id.in_(workspace_ids)
    ).first()

    if not memory:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found")

    try:
        db.delete(memory)
        db.commit()
        return {"message": "Memory deleted successfully"}
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting memory: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting memory: {str(e)}"
        )


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload a document to Supabase Storage, parse it, and store chunks in pgvector."""
    user_id = current_user.id
    workspace_id = get_user_workspace(db, user_id)

    try:
        from backend.services.document_parser import extract_text_from_file, chunk_text

        file_content = await file.read()

        # 1. Try to upload to Supabase Storage with strict 10s timeout
        file_url = ""
        file_path = f"{user_id}/{uuid.uuid4()}_{file.filename}"
        try:
            import concurrent.futures

            def _storage_upload():
                return supabase.storage.from_("documents").upload(
                    path=file_path,
                    file=file_content,
                    file_options={"content-type": file.content_type or "application/octet-stream"}
                )

            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(_storage_upload)
                future.result(timeout=10)

            file_url = supabase.storage.from_("documents").get_public_url(file_path)
            logger.info(f"File uploaded to Supabase Storage: {file_path}")
        except concurrent.futures.TimeoutError:
            logger.warning("Supabase Storage upload timed out — storing metadata only")
            file_url = f"local://{file.filename}"
        except Exception as storage_err:
            logger.warning(f"Supabase Storage upload failed: {storage_err} — storing metadata only")
            file_url = f"local://{file.filename}"

        # 2. Extract Text
        text = extract_text_from_file(file_content, file.filename)
        if not text:
            raise ValueError("No extractable text found in file")

        chunks = chunk_text(text, chunk_size=1000, overlap=100)
        if not chunks:
            raise ValueError("File content too short or failed to chunk")

        # 3. Save Document record first (always succeeds independently of embedding)
        document = Document(
            workspace_id=workspace_id,
            uploaded_by=user_id,
            file_name=file.filename,
            file_url=file_url,
            file_type=file.content_type,
            file_size=len(file_content),
            embedding_status="pending"
        )
        db.add(document)
        db.commit()
        db.refresh(document)

        # Serialize immediately while session is open
        doc_id = str(document.id)

        # 4. Generate and save Embeddings (best-effort — upload ALWAYS succeeds)
        try:
            vector_store = get_vector_store()
            vector_store.add_chunks(chunks=chunks, document_id=document.id)
            document.embedding_status = "completed"
            db.commit()
            logger.info(f"Processed {file.filename} into {len(chunks)} chunks for user {user_id}")
        except Exception as embed_err:
            logger.warning(f"Embedding skipped for document {doc_id}: {embed_err}")
            document.embedding_status = "failed"
            db.commit()

        return {"message": "Document uploaded and processed successfully", "document_id": doc_id}

    except Exception as e:
        db.rollback()
        import traceback
        tb = traceback.format_exc()
        logger.error(f"Error processing document upload: {e}\n{tb}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing document: {str(e)}"
        )

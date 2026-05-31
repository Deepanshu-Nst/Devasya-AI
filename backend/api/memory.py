"""
Memory management endpoints for Devasya AI.
Now uses Supabase storage, pgvector, and new SQLAlchemy schema.
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
import logging
import uuid
import os
from supabase import create_client, Client

from backend.config.settings import settings
from backend.db.postgres import get_db
from backend.db.vector_store import get_vector_store
from backend.models.schema import MemoryPage, Document, Profile, Workspace, MemoryCreate, MemoryResponse
from backend.api.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/memory", tags=["memory"])

# Initialize Supabase client for storage operations
# We use SERVICE_ROLE_KEY here to bypass RLS for server-side uploads.
# Falls back to ANON_KEY if service role key is not configured (storage upload may fail due to RLS).
_supabase_key = settings.SUPABASE_SERVICE_ROLE_KEY or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or settings.SUPABASE_ANON_KEY
supabase: Client = create_client(
    settings.SUPABASE_URL,
    _supabase_key
)

def get_user_workspace(db: Session, user_id: uuid.UUID) -> uuid.UUID:
    """Helper to get or create the default workspace for a user."""
    workspace = db.query(Workspace).filter(Workspace.owner_id == user_id).first()
    if not workspace:
        workspace = Workspace(owner_id=user_id, name="Personal Workspace")
        db.add(workspace)
        db.commit()
        db.refresh(workspace)
    return workspace.id

@router.post("/add", response_model=MemoryResponse)
def add_memory(
    memory_data: MemoryCreate,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a new memory page to user's knowledge base."""
    user_id = current_user.id
    workspace_id = get_user_workspace(db, user_id)
    
    try:
        # Create MemoryPage record
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
        
        # Embed and index the content (best-effort — never fails the whole request)
        try:
            from backend.services.document_parser import chunk_text
            chunks = chunk_text(memory_data.content, chunk_size=1000, overlap=100)
            vector_store = get_vector_store()
            vector_store.add_chunks(
                chunks=chunks if chunks else [memory_data.content],
                memory_id=new_memory.id
            )
            logger.info(f"MemoryPage {new_memory.id} embedded and stored")
        except Exception as embed_err:
            logger.warning(
                f"Embedding failed for memory {new_memory.id} (content saved, search degraded): {embed_err}"
            )
        
        return new_memory
    
    except Exception as e:
        db.rollback()
        import traceback
        tb = traceback.format_exc()
        logger.error(f"Error adding memory: {e}\n{tb}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error adding memory: {str(e)}"
        )


@router.get("/list")
def list_memories(
    skip: int = 0,
    limit: int = 10,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List user's memory pages with pagination."""
    user_id = current_user.id
    
    try:
        # User can see any memory page in their workspaces
        workspaces = db.query(Workspace.id).filter(Workspace.owner_id == user_id).subquery()
        
        memories = db.query(MemoryPage).filter(
            MemoryPage.workspace_id.in_(workspaces)
        ).offset(skip).limit(limit).all()
        
        total = db.query(MemoryPage).filter(
            MemoryPage.workspace_id.in_(workspaces)
        ).count()
        
        return {
            "total": total,
            "skip": skip,
            "limit": limit,
            "memories": [MemoryResponse.from_orm(m) for m in memories]
        }
    except Exception as e:
        logger.error(f"Error listing memories: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing memories: {str(e)}"
        )


@router.get("/{memory_id}", response_model=MemoryResponse)
def get_memory(
    memory_id: str,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific memory page."""
    user_id = current_user.id
    workspaces = db.query(Workspace.id).filter(Workspace.owner_id == user_id).subquery()
    
    try:
        mem_uuid = uuid.UUID(memory_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid memory ID")
    
    memory = db.query(MemoryPage).filter(
        MemoryPage.id == mem_uuid,
        MemoryPage.workspace_id.in_(workspaces)
    ).first()
    
    if not memory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Memory not found"
        )
    
    return memory


@router.put("/{memory_id}", response_model=MemoryResponse)
def update_memory(
    memory_id: str,
    memory_update: MemoryCreate,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Edit memory details. (This creates new vector chunks)."""
    user_id = current_user.id
    workspaces = db.query(Workspace.id).filter(Workspace.owner_id == user_id).subquery()
    
    try:
        mem_uuid = uuid.UUID(memory_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid memory ID")
        
    memory = db.query(MemoryPage).filter(
        MemoryPage.id == mem_uuid,
        MemoryPage.workspace_id.in_(workspaces)
    ).first()
    
    if not memory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Memory not found"
        )
        
    try:
        memory.content = memory_update.content
        if memory_update.title:
            memory.title = memory_update.title
        if memory_update.visibility:
            memory.visibility = memory_update.visibility
            
        db.commit()
        db.refresh(memory)
        
        # Re-embed (best-effort — never fails the update request)
        try:
            from backend.models.schema import DocumentChunk
            db.query(DocumentChunk).filter(DocumentChunk.memory_id == memory.id).delete()
            db.commit()
                
            from backend.services.document_parser import chunk_text
            chunks = chunk_text(memory_update.content, chunk_size=1000, overlap=100)
            
            vector_store = get_vector_store()
            vector_store.add_chunks(
                chunks=chunks if chunks else [memory_update.content],
                memory_id=memory.id
            )
        except Exception as embed_err:
            logger.warning(f"Re-embedding failed for memory {memory.id} (content updated, search degraded): {embed_err}")
        
        return memory
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
    workspaces = db.query(Workspace.id).filter(Workspace.owner_id == user_id).subquery()
    
    try:
        mem_uuid = uuid.UUID(memory_id)
    except ValueError:
        # If it's a temporary ID from the frontend that wasn't saved yet, just return success
        return {"message": "Temporary memory deleted"}
        
    memory = db.query(MemoryPage).filter(
        MemoryPage.id == mem_uuid,
        MemoryPage.workspace_id.in_(workspaces)
    ).first()
    
    if not memory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Memory not found"
        )
    
    try:
        # Delete from DB (cascade deletes the DocumentChunk records)
        db.delete(memory)
        db.commit()
        
        logger.info(f"Memory {memory_id} deleted for user {user_id}")
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
        
        # 1. Try to upload to Supabase Storage with strict timeout
        # The supabase-py client has no built-in per-request timeout, so we run
        # it in a thread and enforce a 10-second limit ourselves.
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
                future.result(timeout=10)  # Abort if Supabase takes > 10 s

            file_url = supabase.storage.from_("documents").get_public_url(file_path)
            logger.info(f"File uploaded to Supabase Storage: {file_path}")
        except concurrent.futures.TimeoutError:
            logger.warning(
                "Supabase Storage upload timed out after 10 s — skipping cloud backup, "
                "continuing with local text processing."
            )
            file_url = f"local://{file.filename}"
        except Exception as storage_err:
            logger.warning(
                f"Supabase Storage upload failed: {storage_err}. "
                "Continuing with text extraction and embedding only."
            )
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
            
        # 4. Generate and save Embeddings (best-effort — upload ALWAYS succeeds)
        try:
            vector_store = get_vector_store()
            vector_store.add_chunks(
                chunks=chunks,
                document_id=document.id
            )
            # Mark embedding complete
            document.embedding_status = "completed"
            db.commit()
            logger.info(f"Processed {file.filename} into {len(chunks)} chunks for user {user_id}")
        except Exception as embed_err:
            logger.warning(
                f"Embedding failed for document {document.id} (file saved, search degraded): {embed_err}"
            )
            document.embedding_status = "failed"
            db.commit()
            
        return {"message": "Document uploaded and processed successfully", "document_id": str(document.id)}
    
    except Exception as e:
        db.rollback()
        import traceback
        tb = traceback.format_exc()
        print(f"Error processing document upload: {e}\n{tb}")
        logger.error(f"Error processing document upload: {e}\n{tb}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing document: {str(e)}\n\nTraceback:\n{tb}"
        )

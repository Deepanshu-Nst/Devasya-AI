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
# We use SERVICE_ROLE_KEY here to bypass RLS for server-side uploads
# (Alternatively, the user could upload directly from the frontend)
supabase: Client = create_client(
    settings.SUPABASE_URL, 
    os.environ.get("SUPABASE_SERVICE_ROLE_KEY", settings.SUPABASE_ANON_KEY) # Fallback to anon key if not set
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
        
        # Add to vector store (pgvector)
        # For small memories, we can just embed the whole content as one chunk.
        # For larger memories, we might want to chunk it.
        from backend.services.document_parser import chunk_text
        chunks = chunk_text(memory_data.content, chunk_size=1000, overlap=100)
        
        vector_store = get_vector_store()
        vector_store.add_chunks(
            chunks=chunks if chunks else [memory_data.content],
            memory_id=new_memory.id
        )
        
        logger.info(f"MemoryPage {new_memory.id} added for user {user_id}")
        return new_memory
    
    except Exception as e:
        db.rollback()
        logger.error(f"Error adding memory: {e}")
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
    memory_id: uuid.UUID,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific memory page."""
    user_id = current_user.id
    workspaces = db.query(Workspace.id).filter(Workspace.owner_id == user_id).subquery()
    
    memory = db.query(MemoryPage).filter(
        MemoryPage.id == memory_id,
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
    memory_id: uuid.UUID,
    memory_update: MemoryCreate,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Edit memory details. (This creates new vector chunks)."""
    user_id = current_user.id
    workspaces = db.query(Workspace.id).filter(Workspace.owner_id == user_id).subquery()
    
    memory = db.query(MemoryPage).filter(
        MemoryPage.id == memory_id,
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
        
        # In a real app, we would delete the old DocumentChunk records via SQL.
        # Cascade delete is not set up on update, so we manually delete old chunks:
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
    memory_id: uuid.UUID,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a memory page."""
    user_id = current_user.id
    workspaces = db.query(Workspace.id).filter(Workspace.owner_id == user_id).subquery()
    
    memory = db.query(MemoryPage).filter(
        MemoryPage.id == memory_id,
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
        
        # 1. Upload to Supabase Storage
        file_path = f"{user_id}/{uuid.uuid4()}_{file.filename}"
        res = supabase.storage.from_("documents").upload(
            path=file_path,
            file=file_content,
            file_options={"content-type": file.content_type}
        )
        
        # Get public URL
        file_url = supabase.storage.from_("documents").get_public_url(file_path)
        
        # 2. Extract Text
        text = extract_text_from_file(file_content, file.filename)
        
        if not text:
            raise ValueError("No extractable text found in file")
            
        chunks = chunk_text(text, chunk_size=1000, overlap=100)
        
        if not chunks:
            raise ValueError("File content too short or failed to chunk")
            
        # 3. Save Document record
        document = Document(
            workspace_id=workspace_id,
            uploaded_by=user_id,
            file_name=file.filename,
            file_url=file_url,
            file_type=file.content_type,
            file_size=len(file_content),
            embedding_status="completed"
        )
        db.add(document)
        db.commit()
        db.refresh(document)
            
        # 4. Generate and save Embeddings to pgvector
        vector_store = get_vector_store()
        vector_store.add_chunks(
            chunks=chunks,
            document_id=document.id
        )
            
        logger.info(f"Processed {file.filename} into {len(chunks)} chunks for user {user_id}")
        return {"message": "Document uploaded and processed successfully", "document_id": str(document.id)}
    
    except Exception as e:
        db.rollback()
        logger.error(f"Error processing document upload: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing document: {str(e)}"
        )

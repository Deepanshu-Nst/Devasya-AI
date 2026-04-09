"""
Memory management endpoints for Devasya AI.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Header, UploadFile, File
from sqlalchemy.orm import Session
import logging

from backend.db.postgres import get_db
from backend.db.vector_store import get_vector_store
from backend.models.schema import Memory, MemoryCreate, MemoryResponse, User
from backend.api.auth import get_current_user, decode_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/memory", tags=["memory"])


@router.post("/add", response_model=MemoryResponse)
def add_memory(
    memory_data: MemoryCreate,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """Add a new memory to user's knowledge base."""
    # Validate token
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header"
        )
    
    token = authorization.split("Bearer ")[1]
    user_id = decode_token(token)
    
    # Verify user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    try:
        # Create memory record in PostgreSQL
        new_memory = Memory(
            user_id=user_id,
            content=memory_data.content,
            title=memory_data.title,
            metadata=memory_data.metadata
        )
        db.add(new_memory)
        db.commit()
        db.refresh(new_memory)
        
        # Add to vector store
        vector_store = get_vector_store()
        embedding_id = f"memory_{new_memory.id}_{user_id}"
        vector_store.add_document(
            user_id=user_id,
            content=memory_data.content,
            document_id=embedding_id,
            metadata={
                "memory_id": str(new_memory.id),
                "title": memory_data.title or "Untitled"
            }
        )
        
        # Update embedding_id in database
        new_memory.embedding_id = embedding_id
        db.commit()
        
        logger.info(f"Memory {new_memory.id} added for user {user_id}")
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
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """List user's memories with pagination."""
    # Validate token
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header"
        )
    
    token = authorization.split("Bearer ")[1]
    user_id = decode_token(token)
    
    try:
        memories = db.query(Memory).filter(
            Memory.user_id == user_id,
            Memory.is_active == True
        ).offset(skip).limit(limit).all()
        
        total = db.query(Memory).filter(
            Memory.user_id == user_id,
            Memory.is_active == True
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
    memory_id: int,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """Get a specific memory."""
    # Validate token
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header"
        )
    
    token = authorization.split("Bearer ")[1]
    user_id = decode_token(token)
    
    memory = db.query(Memory).filter(
        Memory.id == memory_id,
        Memory.user_id == user_id
    ).first()
    
    if not memory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Memory not found"
        )
    
    return memory


@router.put("/{memory_id}", response_model=MemoryResponse)
def update_memory(
    memory_id: int,
    memory_update: MemoryCreate,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """Edit memory details."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header"
        )
        
    token = authorization.split("Bearer ")[1]
    user_id = decode_token(token)
    
    memory = db.query(Memory).filter(
        Memory.id == memory_id,
        Memory.user_id == user_id
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
        if memory_update.metadata:
            memory.meta_data = memory_update.metadata
            
        db.commit()
        db.refresh(memory)
        
        # update vector DB
        vector_store = get_vector_store()
        if memory.embedding_id:
            vector_store.delete_document(memory.embedding_id)
            
        new_embedding_id = f"memory_{memory.id}_{user_id}"
        vector_store.add_document(
            user_id=user_id,
            content=memory_update.content,
            document_id=new_embedding_id,
            metadata={
                "memory_id": str(memory.id),
                "title": memory.title or "Untitled"
            }
        )
        
        memory.embedding_id = new_embedding_id
        db.commit()
        
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
    memory_id: int,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """Delete a memory."""
    # Validate token
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header"
        )
    
    token = authorization.split("Bearer ")[1]
    user_id = decode_token(token)
    
    memory = db.query(Memory).filter(
        Memory.id == memory_id,
        Memory.user_id == user_id
    ).first()
    
    if not memory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Memory not found"
        )
    
    try:
        # Soft delete from database
        memory.is_active = False
        db.commit()
        
        # Delete from vector store
        if memory.embedding_id:
            vector_store = get_vector_store()
            vector_store.delete_document(memory.embedding_id)
        
        logger.info(f"Memory {memory_id} deleted for user {user_id}")
        return {"message": "Memory deleted successfully"}
    
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting memory: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting memory: {str(e)}"
        )


@router.post("/upload", response_model=list[MemoryResponse])
async def upload_document(
    file: UploadFile = File(...),
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """Upload a document, parse it, and store as memory chunks."""
    # Validate token
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header"
        )
    
    token = authorization.split("Bearer ")[1]
    user_id = decode_token(token)
    
    # Verify user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    try:
        from backend.services.document_parser import extract_text_from_file, chunk_text
        
        file_content = await file.read()
        text = extract_text_from_file(file_content, file.filename)
        
        if not text:
            raise ValueError("No extractable text found in file")
            
        chunks = chunk_text(text, chunk_size=500, overlap=100)
        
        if not chunks:
            raise ValueError("File content too short or failed to chunk")
            
        added_memories = []
        vector_store = get_vector_store()
        
        for i, chunk in enumerate(chunks):
            # Create memory record in PostgreSQL
            new_memory = Memory(
                user_id=user_id,
                content=chunk,
                title=f"{file.filename} (Part {i+1})",
                meta_data={
                    "source": file.filename,
                    "type": "document",
                    "chunk_index": i,
                    "total_chunks": len(chunks)
                }
            )
            db.add(new_memory)
            db.commit()
            db.refresh(new_memory)
            
            # Add to vector store
            embedding_id = f"doc_{new_memory.id}_{user_id}"
            vector_store.add_document(
                user_id=user_id,
                content=chunk,
                document_id=embedding_id,
                metadata={
                    "memory_id": str(new_memory.id),
                    "title": new_memory.title,
                    "source": file.filename
                }
            )
            
            # Update embedding_id in database
            new_memory.embedding_id = embedding_id
            db.commit()
            added_memories.append(new_memory)
            
        logger.info(f"Processed {file.filename} into {len(chunks)} chunks for user {user_id}")
        return added_memories
    
    except Exception as e:
        db.rollback()
        logger.error(f"Error processing document upload: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing document: {str(e)}"
        )

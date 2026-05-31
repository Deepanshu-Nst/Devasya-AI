from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import uuid
import logging

from backend.db.postgres import get_db
from backend.models.schema import Block, Profile
from backend.api.auth import get_current_user
from backend.api.memory import get_user_workspace

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/blocks", tags=["blocks"])

def _embed_block_background(block_id: uuid.UUID, content: str):
    """Background task to generate embeddings for a block."""
    try:
        from backend.db.vector_store import get_vector_store
        vector_store = get_vector_store()
        
        # We assume content is either plain text or a JSON array of inline text.
        # Let's extract raw text if it's JSON.
        import json
        text_to_embed = content
        try:
            parsed = json.loads(content)
            if isinstance(parsed, list):
                # Simple extraction of text fields from inline content
                text_to_embed = " ".join([item.get("text", "") for item in parsed if isinstance(item, dict) and "text" in item])
        except Exception:
            pass
            
        if not text_to_embed.strip():
            return
            
        # Re-embed: we delete old chunks for this block first
        from backend.db.postgres import SessionLocal
        from backend.models.schema import DocumentChunk
        db = SessionLocal()
        try:
            db.query(DocumentChunk).filter(DocumentChunk.block_id == block_id).delete()
            db.commit()
        finally:
            db.close()
            
        vector_store.add_chunks(
            chunks=[text_to_embed],
            block_id=block_id
        )
        logger.info(f"Background embedding completed for block {block_id}")
    except Exception as embed_err:
        logger.warning(f"Background embedding failed for block {block_id}: {embed_err}")

class BlockCreate(BaseModel):
    type: str
    parent_id: Optional[uuid.UUID] = None
    content: Optional[str] = None
    properties: Optional[Dict[str, Any]] = {}
    position: Optional[float] = 0.0

class BlockUpdate(BaseModel):
    content: Optional[str] = None
    properties: Optional[Dict[str, Any]] = None
    position: Optional[float] = None
    parent_id: Optional[uuid.UUID] = None

class BlockResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    parent_id: Optional[uuid.UUID]
    type: str
    content: Optional[str]
    properties: Dict[str, Any]
    position: float
    created_by: Optional[uuid.UUID]

    class Config:
        from_attributes = True

@router.get("/pages", response_model=List[BlockResponse])
def list_pages(
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all top-level page blocks for the current user's workspace."""
    workspace_id = get_user_workspace(db, current_user.id)
    pages = db.query(Block).filter(
        Block.workspace_id == workspace_id,
        Block.type == "page"
    ).order_by(Block.updated_at.desc()).all()
    
    return pages

@router.get("/{block_id}", response_model=BlockResponse)
def get_block(
    block_id: uuid.UUID,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workspace_id = get_user_workspace(db, current_user.id)
    block = db.query(Block).filter(
        Block.id == block_id,
        Block.workspace_id == workspace_id
    ).first()
    
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")
    
    return block

@router.get("/{block_id}/children", response_model=List[BlockResponse])
def get_block_children(
    block_id: uuid.UUID,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workspace_id = get_user_workspace(db, current_user.id)
    children = db.query(Block).filter(
        Block.parent_id == block_id,
        Block.workspace_id == workspace_id
    ).order_by(Block.position.asc()).all()
    
    return children

@router.post("/", response_model=BlockResponse)
def create_block(
    block_data: BlockCreate,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workspace_id = get_user_workspace(db, current_user.id)
    
    new_block = Block(
        workspace_id=workspace_id,
        parent_id=block_data.parent_id,
        type=block_data.type,
        content=block_data.content,
        properties=block_data.properties,
        position=block_data.position,
        created_by=current_user.id
    )
    
    db.add(new_block)
    db.commit()
    db.refresh(new_block)
    return new_block

@router.put("/{block_id}", response_model=BlockResponse)
def update_block(
    block_id: uuid.UUID,
    block_update: BlockUpdate,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workspace_id = get_user_workspace(db, current_user.id)
    block = db.query(Block).filter(
        Block.id == block_id,
        Block.workspace_id == workspace_id
    ).first()
    
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")
    
    if block_update.content is not None:
        block.content = block_update.content
    if block_update.properties is not None:
        block.properties = block_update.properties
    if block_update.position is not None:
        block.position = block_update.position
    if block_update.parent_id is not None:
        block.parent_id = block_update.parent_id
        
    db.commit()
    db.refresh(block)
    return block

@router.delete("/{block_id}")
def delete_block(
    block_id: uuid.UUID,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workspace_id = get_user_workspace(db, current_user.id)
    block = db.query(Block).filter(
        Block.id == block_id,
        Block.workspace_id == workspace_id
    ).first()
    
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")
        
    db.delete(block)
    db.commit()
    return {"status": "success"}

@router.post("/batch")
def batch_update_blocks(
    operations: List[Dict[str, Any]],
    background_tasks: BackgroundTasks,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Handle batch block updates (insert, update, delete) to support 
    BlockNote's real-time saving mechanism.
    """
    workspace_id = get_user_workspace(db, current_user.id)
    results = []
    
    # In a real production scenario, this should be a single transaction
    # with more robust error handling
    for op in operations:
        op_type = op.get("op")
        block_data = op.get("block", {})
        block_id = block_data.get("id")
        
        if op_type == "insert" or op_type == "update":
            # Check if block exists
            existing = db.query(Block).filter(
                Block.id == block_id,
                Block.workspace_id == workspace_id
            ).first() if block_id else None
            
            if existing:
                existing.content = block_data.get("content")
                existing.properties = block_data.get("properties", {})
                existing.position = block_data.get("position", 0.0)
                existing.type = block_data.get("type", "paragraph")
                existing.parent_id = block_data.get("parent_id")
            else:
                new_block = Block(
                    id=block_id or uuid.uuid4(),
                    workspace_id=workspace_id,
                    parent_id=block_data.get("parent_id"),
                    type=block_data.get("type", "paragraph"),
                    content=block_data.get("content"),
                    properties=block_data.get("properties", {}),
                    position=block_data.get("position", 0.0),
                    created_by=current_user.id
                )
                db.add(new_block)
                
        elif op_type == "delete":
            db.query(Block).filter(
                Block.id == block_id,
                Block.workspace_id == workspace_id
            ).delete()
            
    db.commit()
    
    # Trigger background embeddings for updated/inserted text blocks
    for op in operations:
        op_type = op.get("op")
        block_data = op.get("block", {})
        block_id = block_data.get("id")
        content = block_data.get("content")
        block_type = block_data.get("type", "")
        
        # Only embed meaningful text blocks
        if (op_type == "insert" or op_type == "update") and content and block_type in ["paragraph", "heading", "bulletListItem", "numberedListItem", "checkListItem"]:
            background_tasks.add_task(_embed_block_background, uuid.UUID(block_id) if isinstance(block_id, str) else block_id, content)

    return {"status": "success", "processed": len(operations)}

@router.post("/query", response_model=List[BlockResponse])
def query_blocks(
    query_params: Dict[str, Any],
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Query blocks across the entire workspace by type or properties.
    query_params: {"type": "task", "limit": 100}
    """
    workspace_id = get_user_workspace(db, current_user.id)
    
    db_query = db.query(Block).filter(Block.workspace_id == workspace_id)
    
    if "type" in query_params:
        db_query = db_query.filter(Block.type == query_params["type"])
        
    limit = query_params.get("limit", 100)
    
    blocks = db_query.order_by(Block.updated_at.desc()).limit(limit).all()
    return blocks

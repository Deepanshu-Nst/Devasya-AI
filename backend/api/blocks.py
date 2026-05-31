from fastapi import APIRouter, Depends, HTTPException, status
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
    return {"status": "success", "processed": len(operations)}

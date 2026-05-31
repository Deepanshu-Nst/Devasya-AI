import uuid
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from datetime import datetime

from backend.db.postgres import get_db
from backend.api.auth import get_current_user
from backend.api.memory import get_user_workspace
from backend.models.schema import Task, Block, Profile, Workspace

router = APIRouter()

# Pydantic schemas for Tasks
class TaskBase(BaseModel):
    status: str = Field(default="Todo")
    priority: Optional[str] = None
    due_date: Optional[datetime] = None
    position: float = Field(default=0.0)
    assigned_to: Optional[uuid.UUID] = None

class TaskCreate(TaskBase):
    title: str = Field(..., description="The title of the task")
    content: Optional[Any] = Field(None, description="BlockNote JSON content")
    properties: Optional[Dict[str, Any]] = Field(default_factory=dict)
    workspace_id: Optional[uuid.UUID] = None
    
class TaskUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[datetime] = None
    position: Optional[float] = None
    assigned_to: Optional[uuid.UUID] = None
    # Block fields
    title: Optional[str] = None
    content: Optional[Any] = None
    properties: Optional[Dict[str, Any]] = None

class TaskResponse(TaskBase):
    id: uuid.UUID
    block_id: uuid.UUID
    workspace_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    # Expanded block data
    title: Optional[str] = None
    content: Optional[Any] = None
    properties: Optional[Dict[str, Any]] = None
    
    class Config:
        from_attributes = True

@router.get("/tasks", response_model=List[TaskResponse])
def get_tasks(
    workspace_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user)
):
    """Get all active tasks in a workspace"""
    if not workspace_id:
        workspace_id = get_user_workspace(db, current_user.id)
        
    # Verify workspace access
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id, Workspace.owner_id == current_user.id).first()
    if not workspace:
        raise HTTPException(status_code=403, detail="Not authorized to access this workspace")
        
    query = db.query(Task).join(Block).filter(
        Task.workspace_id == workspace_id,
        Task.deleted_at == None
    )
    
    if status:
        query = query.filter(Task.status == status)
        
    tasks = query.order_by(Task.position.asc()).limit(limit).all()
    
    # Map into response format combining block and task metadata
    result = []
    for t in tasks:
        # Avoid missing block attributes if block was deleted out of band
        if not t.block:
            continue
            
        block_props = t.block.properties or {}
        title = block_props.get('title')
        
        result.append({
            "id": t.id,
            "block_id": t.block_id,
            "workspace_id": t.workspace_id,
            "status": t.status,
            "priority": t.priority,
            "due_date": t.due_date,
            "position": t.position,
            "assigned_to": t.assigned_to,
            "created_at": t.created_at,
            "updated_at": t.updated_at,
            "title": title,
            "content": t.block.content,
            "properties": block_props
        })
        
    return result


@router.post("/test-task-db")
def test_task_db(
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user)
):
    try:
        workspace_id = get_user_workspace(db, current_user.id)
        new_block = Block(
            workspace_id=workspace_id,
            type="task",
            content="test",
            created_by=current_user.id
        )
        db.add(new_block)
        db.flush()
        
        new_task = Task(
            block_id=new_block.id,
            workspace_id=workspace_id,
            status="Todo"
        )
        db.add(new_task)
        db.commit()
        return {"status": "success", "task_id": new_task.id}
    except Exception as e:
        import traceback
        db.rollback()
        return {"status": "error", "error": str(e), "traceback": traceback.format_exc()}

@router.post("/tasks", response_model=TaskResponse)
def create_task(
    task_data: TaskCreate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user)
):
    """Create a new task (creates both a block and task metadata)"""
    workspace_id = task_data.workspace_id
    if not workspace_id:
        workspace_id = get_user_workspace(db, current_user.id)
        
    # Verify workspace access
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id, Workspace.owner_id == current_user.id).first()
    if not workspace:
        raise HTTPException(status_code=403, detail="Not authorized to access this workspace")
        
    # 1. Create canonical block
    props = task_data.properties or {}
    props['title'] = task_data.title
    import json
    content_str = None
    if task_data.content is not None:
        content_str = json.dumps(task_data.content) if not isinstance(task_data.content, str) else task_data.content

    try:
        new_block = Block(
            workspace_id=workspace_id,
            type="task",
            content=content_str,
            properties=props,
            created_by=current_user.id
        )
        db.add(new_block)
        db.flush() # Get block ID
        
        # 2. Create task metadata
        new_task = Task(
            block_id=new_block.id,
            workspace_id=workspace_id,
            status=task_data.status,
            priority=task_data.priority,
            due_date=task_data.due_date,
            position=task_data.position,
            assigned_to=task_data.assigned_to
        )
        db.add(new_task)
        db.commit()
        db.refresh(new_task)
        db.refresh(new_block)
    except Exception as e:
        import traceback
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)} | Trace: {traceback.format_exc()}")
    
    # Trigger vector index update asynchronously here
    # (To be integrated with vector_store)
    from backend.db.vector_store import get_vector_store
    import json
    
    # Run async embedding update if content is meaningful
    # In a production app, this would be a celery task or background task
    try:
        vs = get_vector_store()
        text_to_embed = f"Task: {task_data.title}"
        if task_data.content:
            text_to_embed += f"\nContent: {json.dumps(task_data.content)}"
        vs.add_chunks(
            chunks=[{
                "id": str(new_block.id),
                "text": text_to_embed,
                "metadata": {
                    "type": "task",
                    "workspace_id": str(workspace_id),
                    "status": task_data.status
                }
            }],
            workspace_id=str(workspace_id)
        )
    except Exception as e:
        import logging
        logging.warning(f"Failed to update vector index for task {new_task.id}: {e}")
        
    import json
    parsed_content = new_block.content
    if parsed_content and isinstance(parsed_content, str):
        try:
            parsed_content = json.loads(parsed_content)
        except:
            pass

    return {
        "id": new_task.id,
        "block_id": new_task.block_id,
        "workspace_id": new_task.workspace_id,
        "status": new_task.status,
        "priority": new_task.priority,
        "due_date": new_task.due_date,
        "position": new_task.position,
        "assigned_to": new_task.assigned_to,
        "created_at": new_task.created_at,
        "updated_at": new_task.updated_at,
        "title": task_data.title,
        "content": parsed_content,
        "properties": new_block.properties
    }


@router.patch("/tasks/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: uuid.UUID,
    task_update: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user)
):
    """Partially update a task and/or its block content"""
    # Find task
    task = db.query(Task).join(Block).filter(
        Task.id == task_id,
        Task.deleted_at == None
    ).first()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    # Verify workspace access
    workspace = db.query(Workspace).filter(Workspace.id == task.workspace_id, Workspace.owner_id == current_user.id).first()
    if not workspace:
        raise HTTPException(status_code=403, detail="Not authorized to modify tasks in this workspace")
        
    # Update Task fields
    update_data = task_update.dict(exclude_unset=True)
    task_fields = ["status", "priority", "due_date", "position", "assigned_to"]
    
    task_updated = False
    for field in task_fields:
        if field in update_data:
            setattr(task, field, update_data[field])
            task_updated = True
            
    # Update Block fields
    block = task.block
    block_updated = False
    
    if "content" in update_data:
        content_data = update_data["content"]
        if not isinstance(content_data, str):
            import json
            content_data = json.dumps(content_data)
        block.content = content_data
        block_updated = True
        
    if "properties" in update_data:
        # Merge properties
        current_props = block.properties or {}
        current_props.update(update_data["properties"])
        block.properties = current_props
        block_updated = True
        
    if "title" in update_data:
        current_props = block.properties or {}
        current_props["title"] = update_data["title"]
        block.properties = current_props
        block_updated = True
        
    if task_updated or block_updated:
        db.commit()
        db.refresh(task)
        db.refresh(block)
        
        # Async vector update
        try:
            from backend.db.vector_store import get_vector_store
            import json
            vs = get_vector_store()
            
            # Since we use overwrite logic, we can just add chunk with same ID
            text_to_embed = f"Task: {block.properties.get('title', 'Untitled')}"
            if block.content:
                text_to_embed += f"\nContent: {json.dumps(block.content)}"
                
            vs.add_chunks(
                chunks=[{
                    "id": str(block.id),
                    "text": text_to_embed,
                    "metadata": {
                        "type": "task",
                        "workspace_id": str(task.workspace_id),
                        "status": task.status
                    }
                }],
                workspace_id=str(task.workspace_id)
            )
        except Exception as e:
            import logging
            logging.warning(f"Failed to update vector index for task {task.id}: {e}")
            
    return {
        "id": task.id,
        "block_id": task.block_id,
        "workspace_id": task.workspace_id,
        "status": task.status,
        "priority": task.priority,
        "due_date": task.due_date,
        "position": task.position,
        "assigned_to": task.assigned_to,
        "created_at": task.created_at,
        "updated_at": task.updated_at,
        "title": block.properties.get('title'),
        "content": block.content,
        "properties": block.properties
    }


@router.delete("/tasks/{task_id}")
def delete_task(
    task_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user)
):
    """Soft delete a task"""
    task = db.query(Task).filter(Task.id == task_id).first()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    # Verify workspace access
    workspace = db.query(Workspace).filter(Workspace.id == task.workspace_id, Workspace.owner_id == current_user.id).first()
    if not workspace:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    # Soft delete
    task.deleted_at = datetime.utcnow()
    
    # We could also soft-delete the block here, but for now we leave it intact
    # since it might be referenced elsewhere, or we might want to recover it.
    
    db.commit()
    
    return {"success": True, "message": "Task deleted"}

"""
Query endpoints for intelligent reasoning and insights.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import logging
import uuid

from backend.db.postgres import get_db
from backend.models.schema import QueryRequest, QueryResponse, Profile, Workspace, ChatSession, ChatMessage
from backend.api.auth import get_current_user
from backend.services.agents import get_orchestrator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/query", tags=["query"])

def get_user_workspace(db: Session, user_id: uuid.UUID) -> uuid.UUID:
    """Helper to get or create the default workspace for a user."""
    workspace = db.query(Workspace).filter(Workspace.owner_id == user_id).first()
    if not workspace:
        workspace = Workspace(owner_id=user_id, name="Personal Workspace")
        db.add(workspace)
        db.commit()
        db.refresh(workspace)
    return workspace.id

@router.post("/ask", response_model=QueryResponse)
async def ask_query(
    query_request: QueryRequest,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Execute multi-agent reasoning pipeline.
    """
    user_id = current_user.id
    workspace_id = get_user_workspace(db, user_id)
    
    try:
        logger.info(f"Processing query for user {user_id}: {query_request.query}")
        
        session_id = query_request.session_id
        
        if not session_id:
            # Create a new session
            new_session = ChatSession(
                workspace_id=workspace_id,
                title=query_request.query[:50] + "..." if len(query_request.query) > 50 else query_request.query,
                created_by=user_id
            )
            db.add(new_session)
            db.commit()
            db.refresh(new_session)
            session_id = new_session.id
        else:
            # Verify session ownership — if not found, create a fresh one
            # (handles stale session IDs from localStorage after backend restarts)
            session = db.query(ChatSession).filter(
                ChatSession.id == session_id,
                ChatSession.workspace_id == workspace_id
            ).first()
            if not session:
                logger.warning(f"Session {session_id} not found for workspace {workspace_id} — creating new session")
                new_session = ChatSession(
                    workspace_id=workspace_id,
                    title=query_request.query[:50] + "..." if len(query_request.query) > 50 else query_request.query,
                    created_by=user_id
                )
                db.add(new_session)
                db.commit()
                db.refresh(new_session)
                session_id = new_session.id
        
        # Save user message
        user_msg = ChatMessage(
            session_id=session_id,
            role="user",
            content=query_request.query
        )
        db.add(user_msg)
        db.commit()
        
        # Get chat history (last 10 messages)
        history = db.query(ChatMessage).filter(
            ChatMessage.session_id == session_id
        ).order_by(ChatMessage.created_at.desc()).limit(10).all()
        
        chat_history = []
        for h in reversed(history):
            chat_history.append({"role": h.role, "content": h.content})
        
        # Call async pipeline
        orchestrator = get_orchestrator()
        # Profile might not be a dict anymore, but LangGraph might expect dict
        profile_dict = {"full_name": current_user.full_name}
        
        result = await orchestrator._async_execute(
            user_id=user_id,
            workspace_id=workspace_id,
            user_query=query_request.query,
            user_profile=profile_dict,
            chat_history=chat_history
        )
        
        insights = result.get("insights", "")
        
        # Save assistant message
        assistant_msg = ChatMessage(
            session_id=session_id,
            role="assistant",
            content=insights
        )
        db.add(assistant_msg)
        db.commit()
        
        return QueryResponse(
            response=insights,
            session_id=session_id,
            context_used=result.get("context", []),
            agent_logs=result.get("agent_logs", {})
        )
    
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print(f"Error processing query: {e}\n{tb}")
        logger.error(f"Error processing query: {e}\n{tb}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing query: {str(e)}\n\nTraceback:\n{tb}"
        )


@router.get("/sessions")
def get_sessions(
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's chat sessions."""
    user_id = current_user.id
    workspace_id = get_user_workspace(db, user_id)
    
    try:
        sessions = db.query(ChatSession).filter(
            ChatSession.workspace_id == workspace_id
        ).order_by(ChatSession.created_at.desc()).all()
        
        return {
            "sessions": [{"id": s.id, "title": s.title, "created_at": s.created_at} for s in sessions]
        }
    except Exception as e:
        logger.error(f"Error retrieving sessions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving sessions: {str(e)}"
        )


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: uuid.UUID,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a chat session entirely."""
    user_id = current_user.id
    workspace_id = get_user_workspace(db, user_id)
    
    try:
        session = db.query(ChatSession).filter(
            ChatSession.id == session_id,
            ChatSession.workspace_id == workspace_id
        ).first()
        
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
            
        db.delete(session)
        db.commit()
        
        return {"message": "Session deleted successfully"}
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting session: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting session: {str(e)}"
        )


@router.get("/history")
def get_query_history(
    skip: int = 0,
    limit: int = 50,
    session_id: uuid.UUID = None,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get messages for a specific session."""
    user_id = current_user.id
    workspace_id = get_user_workspace(db, user_id)
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")
        
    try:
        # Verify ownership
        session = db.query(ChatSession).filter(
            ChatSession.id == session_id,
            ChatSession.workspace_id == workspace_id
        ).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
            
        messages = db.query(ChatMessage).filter(
            ChatMessage.session_id == session_id
        ).order_by(ChatMessage.created_at.asc()).offset(skip).limit(limit).all()
        
        total = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).count()
        
        return {
            "total": total,
            "skip": skip,
            "limit": limit,
            "interactions": messages # Frontend might need adaptation if it expects 'interactions' format
        }
    except Exception as e:
        logger.error(f"Error retrieving query history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving query history: {str(e)}"
        )


@router.get("/{interaction_id}")
def get_interaction(
    interaction_id: uuid.UUID,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get details of a specific message."""
    user_id = current_user.id
    workspace_id = get_user_workspace(db, user_id)
    
    message = db.query(ChatMessage).join(ChatSession).filter(
        ChatMessage.id == interaction_id,
        ChatSession.workspace_id == workspace_id
    ).first()
    
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )
    
    return message

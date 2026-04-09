"""
Query endpoints for intelligent reasoning and insights.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
import logging

from backend.db.postgres import get_db
from backend.models.schema import QueryRequest, QueryResponse, User, Interaction
from backend.api.auth import decode_token
from backend.services.agents import get_orchestrator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/query", tags=["query"])


@router.post("/ask", response_model=QueryResponse)
def ask_query(
    query_request: QueryRequest,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """
    Execute multi-agent reasoning pipeline with optional memory retrieval.
    
    This endpoint:
    1. Validates user authentication
    2. Executes multi-agent pipeline (planner, retriever, reasoner, validator)
    3. Stores interaction for training and analysis
    4. Returns structured insights, connections, and actions
    """
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
        # Execute multi-agent orchestration
        logger.info(f"Processing query for user {user_id}: {query_request.query}")
        
        import uuid
        session_id = query_request.session_id or str(uuid.uuid4())
        
        # Get chat history (last 10 interactions)
        history = db.query(Interaction).filter(
            Interaction.user_id == user_id,
            Interaction.session_id == session_id
        ).order_by(Interaction.created_at.desc()).limit(10).all()
        
        chat_history = []
        for h in reversed(history):
            chat_history.append({"role": "user", "content": h.query})
            answer = h.response.get("insights", "") if isinstance(h.response, dict) else ""
            if answer:
                chat_history.append({"role": "assistant", "content": answer})
        
        orchestrator = get_orchestrator()
        result = orchestrator.execute(
            user_id=user_id,
            user_query=query_request.query,
            chat_history=chat_history
        )
        
        # Store interaction in database for training and analysis
        interaction = Interaction(
            user_id=user_id,
            session_id=session_id,
            query=query_request.query,
            response={
                "insights": result.get("insights", ""),
                "connections": result.get("connections", ""),
                "actions": result.get("actions", "")
            },
            context_used=result.get("context", []),
            agent_logs=result.get("agent_logs", {})
        )
        db.add(interaction)
        db.commit()
        
        logger.info(f"Interaction {interaction.id} stored for user {user_id}")
        
        # Return response
        return QueryResponse(
            insights=result.get("insights", ""),
            connections=result.get("connections", ""),
            actions=result.get("actions", ""),
            context=result.get("context", []),
            agent_logs=result.get("agent_logs", {}),
            session_id=session_id
        )
    
    except Exception as e:
        logger.error(f"Error processing query: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing query: {str(e)}"
        )


@router.get("/sessions")
def get_sessions(
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """Get user's chat sessions."""
    # Validate token
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header"
        )
    
    token = authorization.split("Bearer ")[1]
    user_id = decode_token(token)
    
    try:
        from sqlalchemy import func
        # Find distinct sessions and their first query to use as a title
        subq = db.query(
            Interaction.session_id,
            func.min(Interaction.created_at).label('min_created_at')
        ).filter(Interaction.user_id == user_id).group_by(Interaction.session_id).subquery()
        
        sessions = db.query(Interaction).join(
            subq,
            (Interaction.session_id == subq.c.session_id) & 
            (Interaction.created_at == subq.c.min_created_at)
        ).order_by(Interaction.created_at.desc()).all()
        
        return {
            "sessions": [{"id": s.session_id, "title": s.query[:50] + "..." if len(s.query) > 50 else s.query, "created_at": s.created_at} for s in sessions]
        }
    except Exception as e:
        logger.error(f"Error retrieving sessions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving sessions: {str(e)}"
        )


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: str,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """Delete a chat session entirely."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header"
        )
    
    token = authorization.split("Bearer ")[1]
    user_id = decode_token(token)
    
    try:
        interactions = db.query(Interaction).filter(
            Interaction.user_id == user_id,
            Interaction.session_id == session_id
        ).all()
        
        if not interactions:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
            
        for i in interactions:
            db.delete(i)
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
    limit: int = 10,
    session_id: str = None,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """Get user's query history with pagination."""
    # Validate token
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header"
        )
    
    token = authorization.split("Bearer ")[1]
    user_id = decode_token(token)
    
    try:
        query = db.query(Interaction).filter(Interaction.user_id == user_id)
        if session_id:
            query = query.filter(Interaction.session_id == session_id)
            
        interactions = query.order_by(Interaction.created_at.desc()).offset(skip).limit(limit).all()
        
        total = query.count()
        
        return {
            "total": total,
            "skip": skip,
            "limit": limit,
            "interactions": interactions
        }
    except Exception as e:
        logger.error(f"Error retrieving query history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving query history: {str(e)}"
        )


@router.get("/{interaction_id}")
def get_interaction(
    interaction_id: int,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """Get details of a specific interaction."""
    # Validate token
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header"
        )
    
    token = authorization.split("Bearer ")[1]
    user_id = decode_token(token)
    
    interaction = db.query(Interaction).filter(
        Interaction.id == interaction_id,
        Interaction.user_id == user_id
    ).first()
    
    if not interaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interaction not found"
        )
    
    return interaction

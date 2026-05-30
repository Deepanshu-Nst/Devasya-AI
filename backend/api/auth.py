"""
Authentication endpoints and utilities for Devasya AI (Supabase Managed).
"""
from fastapi import APIRouter, Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from supabase import create_client
import logging
import uuid

from backend.config.settings import settings
from backend.db.postgres import get_db
from backend.models.schema import Profile, UserResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

security = HTTPBearer()

supabase = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_ANON_KEY
)

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> Profile:
    """
    Get current authenticated user from Supabase JWT token.
    Supabase DB triggers automatically provision the Profile row.
    """
    try:
        token = credentials.credentials
        response = supabase.auth.get_user(token)

        if response.user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication"
            )
        
        user_id_str = response.user.id
        
        try:
            user_uuid = uuid.UUID(user_id_str)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token sub format"
            )

        # Find user profile locally (should be auto-provisioned by DB trigger)
        profile = db.query(Profile).filter(Profile.id == user_uuid).first()
        
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User profile not found. Database trigger may have failed."
            )
            
        return profile

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AUTH ERROR: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: Profile = Depends(get_current_user)):
    """Get current user profile."""
    return current_user

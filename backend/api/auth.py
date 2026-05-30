"""
Authentication endpoints and utilities for Devasya AI (Supabase Managed).
"""
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from jose import jwt, JWTError
import logging
import uuid

from backend.config.settings import settings
from backend.db.postgres import get_db
from backend.models.schema import Profile, UserResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

def decode_token(token: str) -> str:
    """Decodes a Supabase JWT and returns the user ID (UUID string)."""
    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False}
        )
        user_id_str = payload.get("sub")
        if not user_id_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: no sub (UUID) found"
            )
        return user_id_str
    except JWTError as e:
        logger.error(f"Invalid Supabase JWT: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )


def get_current_user(
    authorization: str = Header(None),
    db: Session = Depends(get_db)
) -> Profile:
    """
    Get current authenticated user from Supabase JWT token.
    Supabase DB triggers automatically provision the Profile row.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header"
        )
    
    token = authorization.split("Bearer ")[1]
    user_id_str = decode_token(token)
    
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
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found. Database trigger may have failed."
        )
        
    return profile


@router.get("/me", response_model=UserResponse)
def get_me(current_user: Profile = Depends(get_current_user)):
    """Get current user profile."""
    return current_user

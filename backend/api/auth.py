"""
Authentication endpoints and utilities for Devasya AI (Supabase Managed).
"""
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
import jwt
import logging

from backend.config.settings import settings
from backend.db.postgres import get_db
from backend.models.schema import User, UserResponse, UserProfileUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

def get_current_user(
    authorization: str = Header(None),
    db: Session = Depends(get_db)
) -> User:
    """
    Get current authenticated user from Supabase JWT token.
    Auto-provisions local User record if it doesn't exist.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header"
        )
    
    token = authorization.split("Bearer ")[1]
    
    try:
        # Supabase uses HS256 algorithm by default
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False} # Supabase aud can vary
        )
        
        email: str = payload.get("email")
        if not email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: no email found"
            )
            
        # Find user locally
        user = db.query(User).filter(User.email == email).first()
        
        if not user:
            # Auto-provision local user from Supabase token metadata
            user_metadata = payload.get("user_metadata", {})
            name = user_metadata.get("full_name") or user_metadata.get("name")
            picture = user_metadata.get("avatar_url") or user_metadata.get("picture")
            
            user = User(
                email=email,
                full_name=name,
                profile={"picture": picture} if picture else None
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            logger.info(f"Auto-provisioned local user from Supabase: {email}")
            
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is inactive"
            )
            
        return user
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jwt.InvalidTokenError as e:
        logger.error(f"Invalid Supabase JWT: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Get current user profile."""
    return current_user


@router.put("/profile", response_model=UserResponse)
def update_profile(
    profile_data: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user's structured profile."""
    current_user.profile = profile_data.profile
    db.commit()
    db.refresh(current_user)
    
    logger.info(f"Profile updated for user: {current_user.email}")
    return current_user

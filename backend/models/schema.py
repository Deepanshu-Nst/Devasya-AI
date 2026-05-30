"""
SQLAlchemy models for Devasya AI database.
"""
from datetime import datetime
import uuid
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class User(Base):
    """User model for multi-tenant system."""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=True)
    profile = Column(JSON, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    memories = relationship("Memory", back_populates="user", cascade="all, delete-orphan")
    interactions = relationship("Interaction", back_populates="user", cascade="all, delete-orphan")


class Memory(Base):
    """Memory model for storing user knowledge."""
    __tablename__ = "memories"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    title = Column(String(255), nullable=True)
    embedding_id = Column(String(255), nullable=True)  # Reference to ChromaDB document ID
    meta_data = Column(JSON, nullable=True)  # Store additional metadata
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="memories")


class Interaction(Base):
    """Model for storing user interactions and query results."""
    __tablename__ = "interactions"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(36), index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    query = Column(Text, nullable=False)
    response = Column(JSON, nullable=False)  # Structured output
    context_used = Column(JSON, nullable=True)  # Retrieved context
    agent_logs = Column(JSON, nullable=True)  # Multi-agent execution logs
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    user = relationship("User", back_populates="interactions")


# Pydantic schemas for API validation
from pydantic import BaseModel, EmailStr
from typing import Optional, Any


class UserCreate(BaseModel):
    """Schema for user registration."""
    email: EmailStr
    full_name: Optional[str] = None


class UserResponse(BaseModel):
    """Schema for user response."""
    id: int
    email: str
    full_name: Optional[str]
    profile: Optional[dict] = None
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class UserProfileUpdate(BaseModel):
    """Schema for updating user profile."""
    profile: dict


class MemoryCreate(BaseModel):
    """Schema for creating a memory."""
    content: str
    title: Optional[str] = None
    metadata: Optional[dict] = None


class MemoryResponse(BaseModel):
    """Schema for memory response."""
    id: int
    content: str
    title: Optional[str]
    meta_data: Optional[dict] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class InteractionResponse(BaseModel):
    """Schema for interaction response."""
    id: int
    query: str
    response: dict
    context_used: Optional[dict]
    agent_logs: Optional[dict]
    created_at: datetime
    
    class Config:
        from_attributes = True


class QueryRequest(BaseModel):
    """Schema for query request."""
    query: str
    use_memory: bool = True
    session_id: Optional[str] = None


class QueryResponse(BaseModel):
    """Schema for query response."""
    insights: str
    connections: str
    actions: str
    context: Optional[list] = None
    agent_logs: Optional[dict] = None
    session_id: str
    tool_events: Optional[list] = None  # MCP tool activity events for frontend UI

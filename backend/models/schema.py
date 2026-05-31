"""
SQLAlchemy models for Devasya AI database matching Supabase architecture.
"""
from datetime import datetime
import uuid
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, JSON, BigInteger
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, backref
from pgvector.sqlalchemy import Vector

Base = declarative_base()

class Profile(Base):
    """User profile model mapping to auth.users in Supabase."""
    __tablename__ = "profiles"
    
    id = Column(UUID(as_uuid=True), primary_key=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=True)
    avatar_url = Column(String(1024), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    workspaces = relationship("Workspace", back_populates="owner", cascade="all, delete-orphan")
    memory_pages = relationship("MemoryPage", back_populates="creator")
    documents = relationship("Document", back_populates="uploader")
    chat_sessions = relationship("ChatSession", back_populates="creator")
    blocks = relationship("Block", back_populates="creator")


class Workspace(Base):
    """Workspace for organizing data."""
    __tablename__ = "workspaces"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    owner = relationship("Profile", back_populates="workspaces")
    memory_pages = relationship("MemoryPage", back_populates="workspace", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="workspace", cascade="all, delete-orphan")
    chat_sessions = relationship("ChatSession", back_populates="workspace", cascade="all, delete-orphan")
    blocks = relationship("Block", back_populates="workspace", cascade="all, delete-orphan")


class MemoryPage(Base):
    """A page of text memory explicitly created by the user."""
    __tablename__ = "memory_pages"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=True)
    content = Column(Text, nullable=False)
    visibility = Column(String(50), default="private")
    created_by = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    # Chunks are now on Block, but we can leave this empty or removed since memory pages are deprecated
    # chunks = relationship("DocumentChunk", back_populates="memory", cascade="all, delete-orphan")


class Block(Base):
    """An individual block in the workspace (page, paragraph, task, etc.)."""
    __tablename__ = "blocks"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("blocks.id", ondelete="CASCADE"), nullable=True, index=True)
    type = Column(String(50), nullable=False)
    content = Column(Text, nullable=True)
    properties = Column(JSON, default=dict)
    position = Column(Integer, default=0) # Storing as Integer or Float; let's map REAL to Float but SQLAlchemy Float is fine
    created_by = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    workspace = relationship("Workspace", back_populates="blocks")
    creator = relationship("Profile", back_populates="blocks")
    chunks = relationship("DocumentChunk", back_populates="block", cascade="all, delete-orphan")
    
    # Self-referential relationship for nested blocks
    children = relationship("Block", backref=backref('parent', remote_side=[id]), cascade="all, delete-orphan")


class Document(Base):
    """Uploaded files/documents."""
    __tablename__ = "documents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    file_name = Column(String(1024), nullable=False)
    file_url = Column(String(2048), nullable=False)
    file_type = Column(String(100), nullable=True)
    file_size = Column(BigInteger, nullable=True)
    embedding_status = Column(String(50), default="pending")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    workspace = relationship("Workspace", back_populates="documents")
    uploader = relationship("Profile", back_populates="documents")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")


class DocumentChunk(Base):
    """Vector embeddings for memory pages and documents."""
    __tablename__ = "document_chunks"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=True, index=True)
    block_id = Column(UUID(as_uuid=True), ForeignKey("blocks.id", ondelete="CASCADE"), nullable=True, index=True)
    content = Column(Text, nullable=False)
    chunk_index = Column(Integer, nullable=True)
    embedding = Column(Vector(1536)) # OpenAI embedding dimension
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    document = relationship("Document", back_populates="chunks")
    block = relationship("Block", back_populates="chunks")


class ChatSession(Base):
    """A chat thread."""
    __tablename__ = "chat_sessions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    workspace = relationship("Workspace", back_populates="chat_sessions")
    creator = relationship("Profile", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan", order_by="ChatMessage.created_at")


class ChatMessage(Base):
    """An individual message in a chat."""
    __tablename__ = "chat_messages"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(50), nullable=False) # 'user', 'assistant', 'system'
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    session = relationship("ChatSession", back_populates="messages")


# Pydantic schemas for API validation
from pydantic import BaseModel, EmailStr, HttpUrl
from typing import Optional, Any, List

class UserResponse(BaseModel):
    """Schema for profile response."""
    id: uuid.UUID
    email: str
    full_name: Optional[str]
    avatar_url: Optional[str]
    
    class Config:
        from_attributes = True

class MemoryCreate(BaseModel):
    """Schema for creating a memory."""
    content: str
    title: Optional[str] = None
    visibility: Optional[str] = "private"

class MemoryResponse(BaseModel):
    """Schema for memory response. Used for both notes and documents (unified list)."""
    id: uuid.UUID
    workspace_id: uuid.UUID
    title: Optional[str] = None
    content: str
    visibility: str = "private"
    created_at: datetime
    # meta_data: carries document type/source info for uploaded files
    meta_data: Optional[Any] = None

    class Config:
        from_attributes = True  # Pydantic v2: enables ORM mode (model_validate())

class MemoryListResponse(BaseModel):
    """Schema for paginated memory list response."""
    memories: List[Any]  # List of MemoryResponse dicts (mixed notes + documents)
    total: int
    skip: int
    limit: int

class QueryRequest(BaseModel):
    """Schema for query request."""
    query: str
    use_memory: bool = True
    session_id: Optional[uuid.UUID] = None

class QueryResponse(BaseModel):
    """Schema for query response."""
    response: str
    # `insights` is an alias so the frontend can read either field
    insights: Optional[str] = None
    session_id: uuid.UUID
    context_used: Optional[list] = None
    agent_logs: Optional[dict] = None

    class Config:
        populate_by_name = True

    def __init__(self, **data):
        # Auto-populate insights from response so both fields are available
        if 'insights' not in data and 'response' in data:
            data['insights'] = data['response']
        super().__init__(**data)

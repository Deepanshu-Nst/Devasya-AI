"""
PostgreSQL database connection and session management using SQLAlchemy.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool
import logging

from backend.config.settings import settings
from backend.models.schema import Base

logger = logging.getLogger(__name__)

# Create database engine
# Supabase uses transaction pooling on port 6543, so NullPool is recommended
engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    poolclass=NullPool,
)

# Create session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

def init_db():
    """Initialize database tables."""
    try:
        # Tables should be created via Supabase Migrations ideally,
        # but create_all handles missing tables safely.
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables verified successfully")
    except Exception as e:
        logger.error(f"Error verifying database tables: {e}")
        raise

def get_db() -> Session:
    """Get database session for dependency injection."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def close_db():
    """Close database connection."""
    engine.dispose()

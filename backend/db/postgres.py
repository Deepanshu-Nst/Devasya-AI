"""
PostgreSQL database connection and session management.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool
import logging

from backend.config.settings import settings
from backend.models.schema import Base

logger = logging.getLogger(__name__)

# Create database engine
engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    poolclass=NullPool,  # Use NullPool for serverless
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
        Base.metadata.create_all(bind=engine)
        
        # Ensure existing tables have new columns without needing alembic
        with engine.begin() as conn:
            from sqlalchemy import text
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile JSON;"))
            
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
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

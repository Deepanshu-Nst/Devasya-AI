"""
Devasya AI FastAPI application.
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config.settings import settings
from backend.db.postgres import init_db, close_db
from backend.db.vector_store import init_vector_store
from backend.services.embedding import init_embedding_service
from backend.services.llm import init_llm_service
from backend.services.retrieval import init_retrieval_service
from backend.services.agents import get_orchestrator
from backend.api import auth, memory, query

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown."""
    logger.info("Starting Devasya AI application...")
    
    try:
        # Initialize all services
        init_db()
        logger.info("✓ Database initialized")
        
        init_vector_store()
        logger.info("✓ Vector store initialized")
        
        init_embedding_service()
        logger.info("✓ Embedding service initialized")
        
        init_llm_service()
        logger.info("✓ LLM service initialized")
        
        init_retrieval_service()
        logger.info("✓ Retrieval service initialized")
        
        get_orchestrator()
        logger.info("✓ Multi-agent orchestrator initialized")
        
        logger.info("✓✓✓ All services initialized successfully ✓✓✓")
    except Exception as e:
        logger.error(f"Error during startup: {e}")
        raise
    
    yield
    
    logger.info("Shutting down Devasya AI application...")
    close_db()
    logger.info("✓ Database connection closed")


# Create FastAPI app
app = FastAPI(
    title=settings.API_TITLE,
    version=settings.API_VERSION,
    description="Memory-driven intelligence system for enhanced thinking",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(memory.router)
app.include_router(query.router)


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "Devasya AI",
        "version": settings.API_VERSION
    }


@app.get("/")
def root():
    """Root endpoint with API information."""
    return {
        "name": "Devasya AI",
        "version": settings.API_VERSION,
        "description": "Memory-driven intelligence system",
        "docs": "/docs",
        "health": "/health"
    }


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "backend.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.DEBUG
    )

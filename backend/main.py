"""
Devasya AI FastAPI application.
"""
import logging
import traceback
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.config.settings import settings
from backend.db.postgres import init_db, close_db
from backend.db.vector_store import init_vector_store
from backend.services.llm import init_llm_service
from backend.services.retrieval import init_retrieval_service
from backend.services.agents import get_orchestrator
from backend.api import auth, memory, query, blocks, tasks, ai
from backend.mcp.router import router as mcp_router

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
        
        try:
            init_vector_store()
            logger.info("✓ Vector store initialized")
        except Exception as e:
            logger.warning(f"Vector store disabled: {e}")

        init_llm_service()
        logger.info("✓ LLM service initialized")
        
        try:
            init_retrieval_service()
            logger.info("✓ Retrieval service initialized")
        except Exception as e:
            logger.warning(f"Retrieval service disabled: {e}")
        
        try:
            get_orchestrator()
            logger.info("✓ Multi-agent orchestrator initialized")
        except Exception as e:
            logger.warning(f"Orchestrator disabled: {e}")
        
        # Initialize MCP tool registry (registers all tools at startup)
        from backend.mcp.registry import _auto_register_all_tools
        _auto_register_all_tools()
        from backend.mcp.registry import list_tools
        logger.info(f"✓ MCP tool registry initialized: {list(list_tools().keys())}")
        
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

# Build CORS origin list: merge defaults + env-configured origins + FRONTEND_URL
_default_cors = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://devasya-ai.vercel.app",
]
_extra = settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else []
if settings.FRONTEND_URL:
    _extra = _extra + [settings.FRONTEND_URL]
_cors_origins = list(set(_default_cors + _extra))

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(memory.router)
app.include_router(query.router)
app.include_router(blocks.router)
app.include_router(tasks.router, prefix="/api", tags=["tasks"])
app.include_router(ai.router)
app.include_router(mcp_router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all exception handler that logs traceback and returns CORS-safe response."""
    logger.error(f"Unhandled exception on {request.method} {request.url}:")
    logger.error(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"detail": f"{type(exc).__name__}: {str(exc)}"},
    )


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "Devasya AI",
        "version": settings.API_VERSION
    }


@app.get("/routes")
def list_routes():
    return [route.path for route in app.routes]


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

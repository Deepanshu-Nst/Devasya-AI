"""
Configuration settings for Devasya AI backend.
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings with environment variable support."""
    
    # Server
    DEBUG: bool = False
    API_PORT: int = 8000
    API_HOST: str = "0.0.0.0"
    API_TITLE: str = "Devasya AI API"
    API_VERSION: str = "1.0.0"
    
    # Database
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/devasya_db"
    
    # Supabase Auth
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    
    
    # LLM
    LLM_PROVIDER: str = "groq"
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "mixtral-8x7b-32768"
    
    # Embeddings
    HUGGINGFACE_API_KEY: Optional[str] = None
    
    # Redis (optional)
    REDIS_URL: Optional[str] = None
    
    # MCP Tool Keys (optional — tools degrade gracefully without these)
    GITHUB_TOKEN: Optional[str] = None  # For higher GitHub API rate limits
    SERPAPI_KEY: Optional[str] = None   # For richer web search (DuckDuckGo is used if not set)
    
    # CORS
    CORS_ORIGINS: list = ["http://localhost:3000", "http://localhost:8000"]

    class Config:
        env_file = "backend/.env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()

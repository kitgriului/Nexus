"""
Application configuration using Pydantic settings
"""
import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Environment
    ENV: str = "development"  # development, production, test
    DEBUG: bool = True
    
    # API
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    API_PREFIX: str = "/api"
    
    # Database
    DATABASE_URL: str = "postgresql://nexus:nexus@localhost:5432/nexus"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"
    
    # MinIO / S3
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "nexus-media"
    MINIO_SECURE: bool = False  # Use HTTPS
    
    # OpenAI (for Whisper API)
    OPENAI_API_KEY: Optional[str] = None
    
    # Google Gemini
    GEMINI_API_KEY: Optional[str] = None
    
    # Whisper Configuration
    WHISPER_MODE: str = "api"  # "api" or "local"
    WHISPER_MODEL: str = "base"  # For local: tiny, base, small, medium, large
    
    # Processing Limits
    MAX_FILE_SIZE_MB: int = 500
    MAX_DURATION_MINUTES: int = 180  # 3 hours
    
    # Security
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:8000"]
    SECRET_KEY: str = "changeme-in-production"
    
    # Paths
    TEMP_DIR: str = "/tmp/nexus"
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True
    )
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Create temp directory if it doesn't exist
        os.makedirs(self.TEMP_DIR, exist_ok=True)


# Global settings instance
settings = Settings()


# Convenience functions
def is_production() -> bool:
    return settings.ENV == "production"


def is_development() -> bool:
    return settings.ENV == "development"


def is_test() -> bool:
    return settings.ENV == "test"

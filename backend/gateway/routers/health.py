"""
Health check endpoints
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.db.database import get_db
from backend.config.settings import settings

router = APIRouter()


@router.get("/health")
async def health_check():
    """Basic health check"""
    return {
        "status": "ok",
        "service": "nexus-gateway",
        "environment": settings.ENV
    }


@router.get("/health/db")
async def database_health(db: Session = Depends(get_db)):
    """Check database connectivity"""
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "error", "database": "disconnected", "error": str(e)}


@router.get("/health/redis")
async def redis_health():
    """Check Redis connectivity"""
    import redis
    try:
        r = redis.from_url(settings.REDIS_URL)
        r.ping()
        return {"status": "ok", "redis": "connected"}
    except Exception as e:
        return {"status": "error", "redis": "disconnected", "error": str(e)}

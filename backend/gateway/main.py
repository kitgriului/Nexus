"""
FastAPI Gateway - Main Application
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.config.settings import settings
from backend.db.database import init_db
from backend.gateway.routers import media, search, chat, health, websocket, subscriptions


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup
    print("🚀 Starting Nexus Gateway...")
    init_db()
    print("✅ Database initialized")
    yield
    # Shutdown
    print("👋 Shutting down Nexus Gateway...")


app = FastAPI(
    title="Nexus API",
    description="Media Archive with AI Processing",
    version="2.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix=settings.API_PREFIX, tags=["health"])
app.include_router(media.router, prefix=settings.API_PREFIX, tags=["media"])
app.include_router(search.router, prefix=settings.API_PREFIX, tags=["search"])
app.include_router(chat.router, prefix=settings.API_PREFIX, tags=["chat"])
app.include_router(subscriptions.router, prefix=settings.API_PREFIX, tags=["subscriptions"])
app.include_router(websocket.router, tags=["websocket"])


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "type": type(exc).__name__}
    )


@app.get("/")
async def root():
    return {
        "service": "Nexus API Gateway",
        "version": "2.0.0",
        "status": "running",
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.DEBUG
    )

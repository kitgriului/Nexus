"""
Database connection and session management
"""
import os
from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool

from backend.config.settings import settings

# Create engine
engine = create_engine(
    settings.DATABASE_URL,
    poolclass=NullPool if settings.ENV == 'test' else None,
    pool_pre_ping=True,  # Verify connections before using
    echo=settings.DEBUG,  # Log SQL queries in debug mode
)

# Session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency for database sessions
    
    Usage:
        @app.get("/items")
        def get_items(db: Session = Depends(get_db)):
            return db.query(MediaItem).all()
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_context() -> Generator[Session, None, None]:
    """
    Context manager for database sessions (for use in workers)
    
    Usage:
        with get_db_context() as db:
            item = db.query(MediaItem).first()
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_db():
    """
    Initialize database: create tables and pgvector extension
    """
    from backend.db.models import Base
    
    # Enable pgvector extension
    with engine.connect() as conn:
        conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
        conn.commit()
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    # Create vector index for embeddings (ivfflat)
    with engine.connect() as conn:
        # Check if index exists
        result = conn.execute("""
            SELECT 1 FROM pg_indexes 
            WHERE indexname = 'idx_media_embedding'
        """)
        if not result.fetchone():
            conn.execute("""
                CREATE INDEX idx_media_embedding 
                ON media_items 
                USING ivfflat (embedding vector_cosine_ops)
                WITH (lists = 100)
            """)
            conn.commit()
    
    print("✅ Database initialized successfully")


def drop_db():
    """Drop all tables (USE WITH CAUTION - for development only)"""
    from backend.db.models import Base
    Base.metadata.drop_all(bind=engine)
    print("⚠️  All tables dropped")


# Event listeners for debugging
if settings.DEBUG:
    @event.listens_for(engine, "before_cursor_execute")
    def receive_before_cursor_execute(conn, cursor, statement, params, context, executemany):
        print(f"🔍 SQL: {statement}")
        print(f"📊 Params: {params}")

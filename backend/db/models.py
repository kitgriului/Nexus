"""
SQLAlchemy models for Nexus
"""
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from sqlalchemy import (
    String, Integer, Text, TIMESTAMP, Boolean, ARRAY,
    ForeignKey, Index, JSON
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, Mapped, mapped_column
from pgvector.sqlalchemy import Vector

Base = declarative_base()


class MediaItem(Base):
    """Main media items table"""
    __tablename__ = 'media_items'
    
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), 
        primary_key=True, 
        default=lambda: str(uuid4())
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)  # audio, video, youtube
    source_type: Mapped[str] = mapped_column(String(50), nullable=False)  # mic_audio, youtube_url
    source_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Media properties
    duration: Mapped[int] = mapped_column(Integer, default=0)  # seconds
    audio_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    
    # Content
    raw_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    transcript: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)  # speaker turns
    ai_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tags: Mapped[Optional[List[str]]] = mapped_column(ARRAY(String), default=list)
    
    # Embeddings for semantic search
    embedding: Mapped[Optional[List[float]]] = mapped_column(Vector(768), nullable=True)
    
    # Status tracking
    status: Mapped[str] = mapped_column(
        String(50), 
        default='pending'
    )  # pending, processing, completed, error, duplicate
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP, 
        default=datetime.utcnow
    )
    imported_at: Mapped[datetime] = mapped_column(
        TIMESTAMP, 
        default=datetime.utcnow
    )
    
    # Storage reference
    minio_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # Relationships
    processing_jobs: Mapped[List["ProcessingJob"]] = relationship(
        "ProcessingJob", 
        back_populates="media_item",
        cascade="all, delete-orphan"
    )
    
    # Indexes
    __table_args__ = (
        Index('idx_media_status', 'status'),
        Index('idx_created_at', 'created_at'),
        Index('idx_tags', 'tags', postgresql_using='gin'),
        # Vector similarity search index (created separately with ivfflat)
    )
    
    def __repr__(self):
        return f"<MediaItem(id={self.id}, title={self.title}, status={self.status})>"


class ProcessingJob(Base):
    """Tracks processing pipeline jobs"""
    __tablename__ = 'processing_jobs'
    
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), 
        primary_key=True, 
        default=lambda: str(uuid4())
    )
    media_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), 
        ForeignKey('media_items.id', ondelete='CASCADE'),
        nullable=False
    )
    
    # Job status
    status: Mapped[str] = mapped_column(
        String(50), 
        default='pending'
    )  # pending, extracting, hashing, transcribing, enriching, completed, error
    
    # Progress tracking
    current_stage: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    progress_percent: Mapped[int] = mapped_column(Integer, default=0)
    
    # Error handling
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # Celery task tracking
    celery_task_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Timestamps
    started_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP, nullable=True)
    
    # Relationships
    media_item: Mapped["MediaItem"] = relationship("MediaItem", back_populates="processing_jobs")
    
    __table_args__ = (
        Index('idx_job_status', 'status'),
        Index('idx_celery_task_id', 'celery_task_id'),
    )
    
    def __repr__(self):
        return f"<ProcessingJob(id={self.id}, status={self.status}, media_id={self.media_id})>"


class ChatMessage(Base):
    """Chat history with Nexus AI"""
    __tablename__ = 'chat_messages'
    
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), 
        primary_key=True, 
        default=lambda: str(uuid4())
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # user, assistant
    text: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Context tracking - which media items were used
    context_media_ids: Mapped[Optional[List[str]]] = mapped_column(
        ARRAY(String), 
        default=list
    )
    
    # Embeddings for semantic search in chat history
    embedding: Mapped[Optional[List[float]]] = mapped_column(Vector(768), nullable=True)
    
    timestamp: Mapped[datetime] = mapped_column(
        TIMESTAMP, 
        default=datetime.utcnow
    )
    
    __table_args__ = (
        Index('idx_timestamp', 'timestamp'),
        Index('idx_role', 'role'),
    )
    
    def __repr__(self):
        return f"<ChatMessage(id={self.id}, role={self.role}, timestamp={self.timestamp})>"


class Subscription(Base):
    """Subscriptions to YouTube channels, podcasts, etc."""
    __tablename__ = 'subscriptions'
    
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), 
        primary_key=True, 
        default=lambda: str(uuid4())
    )
    url: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)  # channel, podcast, feed
    
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Sync tracking
    last_checked: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP, nullable=True)
    sync_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Metadata
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP, 
        default=datetime.utcnow
    )
    
    __table_args__ = (
        Index('idx_sync_enabled', 'sync_enabled'),
    )
    
    def __repr__(self):
        return f"<Subscription(id={self.id}, title={self.title}, url={self.url})>"

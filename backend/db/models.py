"""
SQLAlchemy models for Nexus
"""
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from sqlalchemy import (
    String, Integer, Text, TIMESTAMP, Boolean, ARRAY,
    ForeignKey, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import DeclarativeBase, relationship, Mapped, mapped_column
from pgvector.sqlalchemy import Vector


class Base(DeclarativeBase):
    pass


class Category(Base):
    """Folders / categories for organizing notes and media"""
    __tablename__ = 'categories'

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4())
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    color: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    icon: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    parent_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey('categories.id', ondelete='SET NULL'), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(TIMESTAMP, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP, default=datetime.utcnow)

    children: Mapped[List["Category"]] = relationship(
        "Category", back_populates="parent", cascade="all, delete-orphan"
    )
    parent: Mapped[Optional["Category"]] = relationship(
        "Category", back_populates="children", remote_side="Category.id"
    )
    media_items: Mapped[List["MediaItem"]] = relationship(
        "MediaItem", back_populates="category"
    )

    __table_args__ = (
        Index('idx_category_parent', 'parent_id'),
    )

    def __repr__(self):
        return f"<Category(id={self.id}, name={self.name})>"


class MediaItem(Base):
    """
    Unified model for all content types:
    - text note  (type='note')
    - audio      (type='audio')
    - video      (type='video')
    - web page   (type='web')
    - youtube    (type='youtube')
    - podcast    (type='podcast')
    """
    __tablename__ = 'media_items'

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4())
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False, default='manual')
    source_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Media properties
    duration: Mapped[int] = mapped_column(Integer, default=0)
    audio_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)

    # Content
    raw_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    transcript: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    ai_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tags: Mapped[Optional[List[str]]] = mapped_column(ARRAY(String), default=list)

    # Vector embedding
    embedding: Mapped[Optional[List[float]]] = mapped_column(Vector(384), nullable=True)

    # Status
    status: Mapped[str] = mapped_column(String(50), default='pending')

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP, default=datetime.utcnow)
    imported_at: Mapped[datetime] = mapped_column(TIMESTAMP, default=datetime.utcnow)

    # Storage
    minio_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Origin
    origin: Mapped[str] = mapped_column(String(50), default='manual')

    # Category / folder
    category_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey('categories.id', ondelete='SET NULL'), nullable=True
    )

    # Subscription
    subscription_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey('subscriptions.id', ondelete='SET NULL'), nullable=True
    )

    # Relationships
    category: Mapped[Optional["Category"]] = relationship(
        "Category", back_populates="media_items"
    )
    processing_jobs: Mapped[List["ProcessingJob"]] = relationship(
        "ProcessingJob", back_populates="media_item", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index('idx_media_status', 'status'),
        Index('idx_created_at', 'created_at'),
        Index('idx_tags', 'tags', postgresql_using='gin'),
        Index('idx_media_category', 'category_id'),
        Index('idx_media_type', 'type'),
    )

    def __repr__(self):
        return f"<MediaItem(id={self.id}, title={self.title}, status={self.status})>"


class ProcessingJob(Base):
    """Tracks processing pipeline jobs"""
    __tablename__ = 'processing_jobs'

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4())
    )
    media_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey('media_items.id', ondelete='CASCADE'), nullable=False
    )

    status: Mapped[str] = mapped_column(String(50), default='pending')
    current_stage: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    progress_percent: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    celery_task_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    started_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP, nullable=True)

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
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4())
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    context_media_ids: Mapped[Optional[List[str]]] = mapped_column(ARRAY(String), default=list)
    embedding: Mapped[Optional[List[float]]] = mapped_column(Vector(384), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(TIMESTAMP, default=datetime.utcnow)

    __table_args__ = (
        Index('idx_timestamp', 'timestamp'),
        Index('idx_role', 'role'),
    )

    def __repr__(self):
        return f"<ChatMessage(id={self.id}, role={self.role}, timestamp={self.timestamp})>"


class Subscription(Base):
    """Subscriptions to YouTube channels, podcasts, RSS feeds"""
    __tablename__ = 'subscriptions'

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4())
    )
    url: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    period_days: Mapped[int] = mapped_column(Integer, default=7)
    last_checked: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP, nullable=True)
    sync_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP, default=datetime.utcnow)

    __table_args__ = (
        Index('idx_sync_enabled', 'sync_enabled'),
    )

    def __repr__(self):
        return f"<Subscription(id={self.id}, title={self.title}, url={self.url})>"

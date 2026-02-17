"""
Media processing endpoints
"""
from datetime import datetime
from typing import List, Optional, Tuple
from urllib.parse import urlparse
from uuid import uuid4

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, HttpUrl

from backend.db.database import get_db
from backend.db.models import MediaItem, ProcessingJob
from backend.workers.tasks import process_media_task

router = APIRouter()


# Request/Response models
class ProcessUrlRequest(BaseModel):
    url: HttpUrl
    title: Optional[str] = None
def classify_url(url: str) -> Tuple[str, str]:
    host = urlparse(url).netloc.lower()
    path = urlparse(url).path.lower()

    if 'youtube.com' in host or 'youtu.be' in host:
        return 'youtube', 'youtube_url'
    if 'instagram.com' in host:
        return 'instagram', 'instagram_url'
    if path.endswith('.xml') or 'rss' in path or 'feed' in path:
        return 'web', 'rss_url'
    return 'web', 'web_url'



class MediaResponse(BaseModel):
    id: str
    title: str
    type: str
    source_type: str
    source_url: Optional[str]
    duration: int
    raw_text: Optional[str]
    ai_summary: Optional[str]
    tags: List[str]
    status: str
    created_at: datetime
    origin: str
    subscription_id: Optional[str]
    
    class Config:
        from_attributes = True


@router.post("/media/process/url")
async def process_url(
    request: ProcessUrlRequest,
    db: Session = Depends(get_db)
):
    """
    Process media from URL (YouTube, etc.)
    """
    # Create media item
    media_id = str(uuid4())
    media_type, source_type = classify_url(str(request.url))
    media_item = MediaItem(
        id=media_id,
        title=request.title or "Processing URL...",
        type=media_type,
        source_type=source_type,
        source_url=str(request.url),
        status="pending"
    )
    db.add(media_item)
    
    # Create processing job
    job_id = str(uuid4())
    job = ProcessingJob(
        id=job_id,
        media_id=media_id,
        status="pending"
    )
    db.add(job)
    db.commit()
    
    # Enqueue Celery task
    task = process_media_task.delay(job_id)
    job.celery_task_id = task.id
    db.commit()
    
    return {
        "job_id": job_id,
        "media_id": media_id,
        "status": "queued",
        "celery_task_id": task.id
    }


@router.post("/media/process/upload")
async def process_upload(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Process uploaded audio file
    """
    from backend.storage.minio_client import MinIOClient
    
    # Generate media ID
    media_id = str(uuid4())
    
    # Save file content to memory first
    content = await file.read()
    
    # Upload to MinIO immediately
    import tempfile
    import os
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        minio_client = MinIOClient()
        minio_path = minio_client.upload_audio(
            file_path=tmp_path,
            media_id=media_id
        )
    finally:
        # Clean up temp file
        os.remove(tmp_path)
    
    # Create media item with MinIO path
    media_item = MediaItem(
        id=media_id,
        title=title or file.filename,
        type="audio",
        source_type="uploaded_audio",
        minio_path=minio_path,
        status="pending"
    )
    db.add(media_item)
    
    # Create processing job
    job_id = str(uuid4())
    job = ProcessingJob(
        id=job_id,
        media_id=media_id,
        status="pending"
    )
    db.add(job)
    db.commit()
    
    # Enqueue task (no file_path needed - will use MinIO)
    task = process_media_task.delay(job_id)
    job.celery_task_id = task.id
    db.commit()
    
    return {
        "job_id": job_id,
        "media_id": media_id,
        "status": "queued",
        "celery_task_id": task.id
    }


@router.get("/media", response_model=List[MediaResponse])
async def list_media(
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    List all media items
    """
    query = db.query(MediaItem)
    if status:
        query = query.filter(MediaItem.status == status)
    
    items = query.order_by(MediaItem.created_at.desc()).offset(skip).limit(limit).all()
    return items


@router.get("/media/{media_id}", response_model=MediaResponse)
async def get_media(media_id: str, db: Session = Depends(get_db)):
    """
    Get single media item
    """
    item = db.query(MediaItem).filter(MediaItem.id == media_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Media not found")
    return item


@router.delete("/media/{media_id}")
async def delete_media(media_id: str, db: Session = Depends(get_db)):
    """
    Delete media item
    """
    item = db.query(MediaItem).filter(MediaItem.id == media_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Media not found")
    
    db.delete(item)
    db.commit()
    
    return {"status": "deleted", "media_id": media_id}


@router.get("/media/{media_id}/job")
async def get_job_status(media_id: str, db: Session = Depends(get_db)):
    """
    Get processing job status for media item
    """
    job = db.query(ProcessingJob).filter(ProcessingJob.media_id == media_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return {
        "job_id": job.id,
        "media_id": job.media_id,
        "status": job.status,
        "current_stage": job.current_stage,
        "progress_percent": job.progress_percent,
        "error_message": job.error_message,
        "celery_task_id": job.celery_task_id
    }

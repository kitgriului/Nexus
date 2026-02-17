"""
Media processing endpoints
"""
from datetime import datetime
from typing import List, Optional
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
    media_item = MediaItem(
        id=media_id,
        title=request.title or "Processing URL...",
        type="youtube",
        source_type="youtube_url",
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
    # Save file temporarily
    from backend.config.settings import settings
    import os
    
    temp_path = os.path.join(settings.TEMP_DIR, f"{uuid4()}_{file.filename}")
    with open(temp_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    # Create media item
    media_id = str(uuid4())
    media_item = MediaItem(
        id=media_id,
        title=title or file.filename,
        type="audio",
        source_type="uploaded_audio",
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
    
    # Enqueue task with file path
    task = process_media_task.delay(job_id, file_path=temp_path)
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

"""
Subscription management endpoints
"""
from typing import List, Optional
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, HttpUrl, conint

from backend.db.database import get_db
from backend.db.models import Subscription, MediaItem

router = APIRouter()


# Request/Response models
class SubscriptionCreate(BaseModel):
    url: HttpUrl
    title: str
    type: str = "site"  # channel, site, podcast
    description: Optional[str] = None
    prompt: Optional[str] = None
    period_days: conint(ge=1, le=365) = 7


class SubscriptionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    sync_enabled: Optional[bool] = None
    prompt: Optional[str] = None
    period_days: Optional[conint(ge=1, le=365)] = None


class SubscriptionResponse(BaseModel):
    id: str
    url: str
    title: str
    type: str
    description: Optional[str]
    prompt: Optional[str]
    period_days: int
    last_checked: Optional[datetime]
    sync_enabled: bool
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/subscriptions", response_model=List[SubscriptionResponse])
async def list_subscriptions(db: Session = Depends(get_db)):
    """Get all subscriptions"""
    subscriptions = db.query(Subscription).all()
    return subscriptions


@router.post("/subscriptions", response_model=SubscriptionResponse)
async def create_subscription(
    subscription: SubscriptionCreate,
    db: Session = Depends(get_db)
):
    """Create new subscription"""
    # Check for duplicates
    existing = db.query(Subscription).filter(
        Subscription.url == str(subscription.url)
    ).first()
    
    if existing:
        raise HTTPException(status_code=409, detail="Subscription already exists")
    
    new_sub = Subscription(
        id=str(uuid4()),
        url=str(subscription.url),
        title=subscription.title,
        type=subscription.type,
        description=subscription.description,
        prompt=subscription.prompt,
        period_days=subscription.period_days,
        sync_enabled=True
    )
    db.add(new_sub)
    db.commit()
    db.refresh(new_sub)
    
    return new_sub


@router.get("/subscriptions/{subscription_id}", response_model=SubscriptionResponse)
async def get_subscription(
    subscription_id: str,
    db: Session = Depends(get_db)
):
    """Get subscription by ID"""
    subscription = db.query(Subscription).filter(
        Subscription.id == subscription_id
    ).first()
    
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    return subscription


@router.patch("/subscriptions/{subscription_id}", response_model=SubscriptionResponse)
async def update_subscription(
    subscription_id: str,
    update: SubscriptionUpdate,
    db: Session = Depends(get_db)
):
    """Update subscription"""
    subscription = db.query(Subscription).filter(
        Subscription.id == subscription_id
    ).first()
    
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    if update.title is not None:
        subscription.title = update.title
    if update.description is not None:
        subscription.description = update.description
    if update.sync_enabled is not None:
        subscription.sync_enabled = update.sync_enabled
    if update.prompt is not None:
        subscription.prompt = update.prompt
    if update.period_days is not None:
        subscription.period_days = update.period_days
    
    db.commit()
    db.refresh(subscription)
    
    return subscription


@router.delete("/subscriptions/{subscription_id}")
async def delete_subscription(
    subscription_id: str,
    db: Session = Depends(get_db)
):
    """Delete subscription and associated media"""
    subscription = db.query(Subscription).filter(
        Subscription.id == subscription_id
    ).first()
    
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    # Delete associated media items if desired
    # For now, just delete the subscription
    db.delete(subscription)
    db.commit()
    
    return {"status": "deleted"}


@router.post("/subscriptions/{subscription_id}/sync")
async def manual_sync_subscription(
    subscription_id: str,
    db: Session = Depends(get_db)
):
    """Manually trigger sync for a subscription"""
    from backend.workers.tasks import process_media_task, process_subscription_task
    from backend.db.models import ProcessingJob
    
    subscription = db.query(Subscription).filter(
        Subscription.id == subscription_id
    ).first()
    
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    # Create job for subscription sync
    job_id = str(uuid4())
    
    try:
        task = process_subscription_task.delay(subscription_id)
        subscription.last_checked = datetime.utcnow()
        db.commit()
        
        return {
            "status": "queued",
            "job_id": job_id,
            "celery_task_id": task.id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to queue sync: {str(e)}")

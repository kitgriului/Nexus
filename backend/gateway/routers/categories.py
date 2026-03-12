"""
Categories (folders) API endpoints
"""
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.db.models import Category, MediaItem

router = APIRouter()


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    parent_id: Optional[str] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    parent_id: Optional[str] = None


class CategoryResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    color: Optional[str]
    icon: Optional[str]
    parent_id: Optional[str]
    created_at: datetime
    item_count: int = 0

    class Config:
        from_attributes = True


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/categories", response_model=List[CategoryResponse])
def list_categories(db: Session = Depends(get_db)):
    """List all categories with item counts."""
    categories = db.query(Category).order_by(Category.name).all()
    result = []
    for cat in categories:
        count = db.query(MediaItem).filter(MediaItem.category_id == cat.id).count()
        result.append(CategoryResponse(
            id=cat.id,
            name=cat.name,
            description=cat.description,
            color=cat.color,
            icon=cat.icon,
            parent_id=cat.parent_id,
            created_at=cat.created_at,
            item_count=count,
        ))
    return result


@router.post("/categories", response_model=CategoryResponse, status_code=201)
def create_category(payload: CategoryCreate, db: Session = Depends(get_db)):
    """Create a new category / folder."""
    if payload.parent_id:
        parent = db.query(Category).filter(Category.id == payload.parent_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent category not found")

    cat = Category(
        id=str(uuid4()),
        name=payload.name,
        description=payload.description,
        color=payload.color,
        icon=payload.icon,
        parent_id=payload.parent_id,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return CategoryResponse(
        id=cat.id, name=cat.name, description=cat.description,
        color=cat.color, icon=cat.icon, parent_id=cat.parent_id,
        created_at=cat.created_at, item_count=0,
    )


@router.get("/categories/{category_id}", response_model=CategoryResponse)
def get_category(category_id: str, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    count = db.query(MediaItem).filter(MediaItem.category_id == cat.id).count()
    return CategoryResponse(
        id=cat.id, name=cat.name, description=cat.description,
        color=cat.color, icon=cat.icon, parent_id=cat.parent_id,
        created_at=cat.created_at, item_count=count,
    )


@router.patch("/categories/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: str, payload: CategoryUpdate, db: Session = Depends(get_db)
):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(cat, field, value)
    cat.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(cat)
    count = db.query(MediaItem).filter(MediaItem.category_id == cat.id).count()
    return CategoryResponse(
        id=cat.id, name=cat.name, description=cat.description,
        color=cat.color, icon=cat.icon, parent_id=cat.parent_id,
        created_at=cat.created_at, item_count=count,
    )


@router.delete("/categories/{category_id}")
def delete_category(category_id: str, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    # Unlink items
    db.query(MediaItem).filter(MediaItem.category_id == category_id).update(
        {"category_id": None}
    )
    db.delete(cat)
    db.commit()
    return {"status": "deleted", "category_id": category_id}

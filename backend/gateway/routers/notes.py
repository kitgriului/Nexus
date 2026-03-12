"""
Text notes API endpoints
"""
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.db.models import MediaItem
from backend.services.embeddings import generate_embedding

router = APIRouter()


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class NoteCreate(BaseModel):
    title: str
    content: str
    tags: Optional[List[str]] = []
    category_id: Optional[str] = None


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[List[str]] = None
    category_id: Optional[str] = None


class NoteResponse(BaseModel):
    id: str
    title: str
    type: str
    raw_text: Optional[str]
    ai_summary: Optional[str]
    tags: List[str]
    status: str
    category_id: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Background enrichment ─────────────────────────────────────────────────────

def _enrich_note(media_id: str, text: str):
    """Generate embedding + AI summary for a note in the background."""
    from backend.db.database import get_db_context
    from backend.services.gemini_service import GeminiService
    from backend.config.settings import settings

    with get_db_context() as db:
        item = db.query(MediaItem).filter(MediaItem.id == media_id).first()
        if not item:
            return

        # Embedding
        try:
            item.embedding = generate_embedding(text[:2000])
        except Exception:
            pass

        # AI summary + tags
        enriched = None
        if settings.GEMINI_API_KEY:
            try:
                gemini = GeminiService()
                enriched = gemini.enrich_transcript(text[:4000])
            except Exception:
                pass
        if enriched is None and settings.OPENAI_API_KEY:
            try:
                from openai import OpenAI
                import json as _json
                client = OpenAI(api_key=settings.OPENAI_API_KEY)
                resp = client.chat.completions.create(
                    model='gpt-4.1-mini',
                    messages=[{'role': 'user', 'content': f'Summarize this text in 2-3 sentences and extract 3-5 tags. Return JSON: {{"aiSummary": "...", "tags": [...]}}\n\n{text[:3000]}'}],
                    max_tokens=300,
                    response_format={'type': 'json_object'},
                )
                raw = resp.choices[0].message.content or '{}'
                parsed = _json.loads(raw)
                enriched = {'ai_summary': parsed.get('aiSummary', ''), 'tags': parsed.get('tags', [])}
            except Exception:
                pass
        if enriched:
            item.ai_summary = enriched.get('ai_summary', '')
            if enriched.get('tags'):
                existing = item.tags or []
                item.tags = list(set(existing + enriched['tags']))

        item.status = 'completed'
        item.updated_at = datetime.utcnow()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/notes", response_model=NoteResponse, status_code=201)
def create_note(
    payload: NoteCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Create a plain-text note and enrich it asynchronously."""
    note_id = str(uuid4())
    note = MediaItem(
        id=note_id,
        title=payload.title,
        type='note',
        source_type='manual_note',
        raw_text=payload.content,
        tags=payload.tags or [],
        category_id=payload.category_id,
        status='processing',
        origin='manual',
    )
    db.add(note)
    db.commit()
    db.refresh(note)

    # Enrich in background
    background_tasks.add_task(_enrich_note, note_id, payload.content)

    return note


@router.get("/notes", response_model=List[NoteResponse])
def list_notes(
    skip: int = 0,
    limit: int = 50,
    category_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List all text notes."""
    query = db.query(MediaItem).filter(MediaItem.type == 'note')
    if category_id:
        query = query.filter(MediaItem.category_id == category_id)
    items = query.order_by(MediaItem.created_at.desc()).offset(skip).limit(limit).all()
    return items


@router.get("/notes/{note_id}", response_model=NoteResponse)
def get_note(note_id: str, db: Session = Depends(get_db)):
    item = db.query(MediaItem).filter(
        MediaItem.id == note_id, MediaItem.type == 'note'
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Note not found")
    return item


@router.patch("/notes/{note_id}", response_model=NoteResponse)
def update_note(
    note_id: str,
    payload: NoteUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    item = db.query(MediaItem).filter(
        MediaItem.id == note_id, MediaItem.type == 'note'
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Note not found")

    re_enrich = False
    if payload.title is not None:
        item.title = payload.title
    if payload.content is not None:
        item.raw_text = payload.content
        re_enrich = True
    if payload.tags is not None:
        item.tags = payload.tags
    if payload.category_id is not None:
        item.category_id = payload.category_id

    item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(item)

    if re_enrich:
        background_tasks.add_task(_enrich_note, note_id, item.raw_text)

    return item


@router.delete("/notes/{note_id}")
def delete_note(note_id: str, db: Session = Depends(get_db)):
    item = db.query(MediaItem).filter(
        MediaItem.id == note_id, MediaItem.type == 'note'
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Note not found")
    db.delete(item)
    db.commit()
    return {"status": "deleted", "note_id": note_id}

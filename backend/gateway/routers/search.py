"""
Semantic search endpoints
"""
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel

from backend.db.database import get_db
from backend.db.models import MediaItem
from backend.services.embeddings import generate_embedding

router = APIRouter()


class SearchRequest(BaseModel):
    query: str
    limit: int = 10
    min_similarity: float = 0.7


class SearchResult(BaseModel):
    id: str
    title: str
    ai_summary: str
    tags: List[str]
    similarity: float
    
    class Config:
        from_attributes = True


@router.post("/search", response_model=List[SearchResult])
async def semantic_search(
    request: SearchRequest,
    db: Session = Depends(get_db)
):
    """
    Semantic search across all media using pgvector
    """
    # Generate embedding for query
    query_embedding = generate_embedding(request.query)
    
    # Convert to PostgreSQL array format
    embedding_str = "[" + ",".join(map(str, query_embedding)) + "]"
    
    # Perform vector similarity search
    query = text("""
        SELECT 
            id, 
            title, 
            ai_summary, 
            tags,
            1 - (embedding <=> CAST(:embedding AS vector)) AS similarity
        FROM media_items
        WHERE 
            embedding IS NOT NULL
            AND status = 'completed'
            AND (1 - (embedding <=> CAST(:embedding AS vector))) >= :min_similarity
        ORDER BY embedding <=> CAST(:embedding AS vector)
        LIMIT :limit
    """)
    
    results = db.execute(
        query,
        {
            "embedding": embedding_str,
            "min_similarity": request.min_similarity,
            "limit": request.limit
        }
    ).fetchall()
    
    return [
        {
            "id": row.id,
            "title": row.title,
            "ai_summary": row.ai_summary or "",
            "tags": row.tags or [],
            "similarity": round(row.similarity, 3)
        }
        for row in results
    ]


@router.get("/search/tags/{tag}")
async def search_by_tag(
    tag: str,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """
    Search media items by tag
    """
    items = db.query(MediaItem).filter(
        MediaItem.tags.contains([tag]),
        MediaItem.status == "completed"
    ).order_by(MediaItem.created_at.desc()).offset(skip).limit(limit).all()
    
    return items

"""
Chat service - RAG (Retrieval-Augmented Generation) with archive
"""
from typing import List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.services.embeddings import generate_embedding
from backend.services.gemini_service import GeminiService
from backend.db.models import MediaItem


async def answer_with_context(
    query: str,
    db: Session,
    max_context_items: int = 5
) -> Tuple[str, List[str]]:
    """
    Answer question using relevant media from archive as context
    
    Returns:
        tuple: (response_text, context_media_ids)
    """
    # Generate query embedding
    query_embedding = generate_embedding(query)
    embedding_str = "[" + ",".join(map(str, query_embedding)) + "]"
    
    # Find most relevant media items
    search_query = text("""
        SELECT 
            id, 
            title,
            ai_summary,
            raw_text,
            1 - (embedding <=> CAST(:embedding AS vector)) AS similarity
        FROM media_items
        WHERE 
            embedding IS NOT NULL
            AND status = 'completed'
        ORDER BY embedding <=> CAST(:embedding AS vector)
        LIMIT :limit
    """)
    
    results = db.execute(
        search_query,
        {
            "embedding": embedding_str,
            "limit": max_context_items
        }
    ).fetchall()
    
    # Build context string
    context_parts = []
    context_ids = []
    
    for row in results:
        context_ids.append(row.id)
        context_parts.append(f"""
Source: {row.title}
Summary: {row.ai_summary}
Content: {row.raw_text[:500]}...
""")
    
    context = "\n---\n".join(context_parts)
    
    # Get answer from Gemini
    gemini = GeminiService()
    response = gemini.answer_question(query, context)
    
    return response, context_ids

"""
Chat service — RAG (Retrieval-Augmented Generation) with the full archive.
Supports all content types: notes, audio, video, web pages, YouTube, etc.
Uses Gemini if GEMINI_API_KEY is set, otherwise falls back to OpenAI.
"""
from typing import List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.services.embeddings import generate_embedding
from backend.config.settings import settings


async def answer_with_context(
    query: str,
    db: Session,
    max_context_items: int = 5,
) -> Tuple[str, List[str]]:
    """
    Answer a user question using the most relevant archive items as context.
    Returns: (response_text, context_media_ids)
    """
    query_embedding = generate_embedding(query)
    embedding_str = "[" + ",".join(map(str, query_embedding)) + "]"

    search_sql = text("""
        SELECT
            id,
            title,
            type,
            ai_summary,
            raw_text,
            tags,
            1 - (embedding <=> CAST(:embedding AS vector)) AS similarity
        FROM media_items
        WHERE
            embedding IS NOT NULL
            AND status = 'completed'
        ORDER BY embedding <=> CAST(:embedding AS vector)
        LIMIT :limit
    """)

    rows = db.execute(
        search_sql,
        {"embedding": embedding_str, "limit": max_context_items},
    ).fetchall()

    context_parts: List[str] = []
    context_ids: List[str] = []

    for row in rows:
        context_ids.append(str(row.id))
        content_snippet = (row.raw_text or '')[:600]
        tags_str = ', '.join(row.tags) if row.tags else ''
        context_parts.append(
            f"[{row.type.upper()}] {row.title}\n"
            f"Summary: {row.ai_summary or 'N/A'}\n"
            f"Tags: {tags_str}\n"
            f"Content: {content_snippet}..."
        )

    context = "\n\n---\n\n".join(context_parts) if context_parts else "No relevant items found in the archive yet."

    prompt = f"""CONTEXT FROM ARCHIVE:
{context}

USER QUESTION: {query}

Answer the question using the provided context. If the context doesn't contain enough information, say so honestly. Be concise and helpful. Answer in the same language as the question."""

    response = await _call_llm(prompt)
    return response, context_ids


async def _call_llm(prompt: str) -> str:
    """Call LLM: Gemini if key available, otherwise OpenAI (async-safe)."""
    import asyncio

    if settings.GEMINI_API_KEY:
        try:
            from backend.services.gemini_service import GeminiService
            gemini = GeminiService()
            return await asyncio.to_thread(gemini.answer_question, "", prompt)
        except Exception as e:
            print(f"Gemini failed, falling back to OpenAI: {e}")

    # OpenAI fallback (run sync client in thread pool)
    def _openai_call():
        from openai import OpenAI
        client_kwargs = {
            "api_key": settings.OPENAI_API_KEY,
            "timeout": 60.0,
        }
        if settings.OPENAI_BASE_URL:
            client_kwargs["base_url"] = settings.OPENAI_BASE_URL
        client = OpenAI(**client_kwargs)
        resp = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1000,
            temperature=0.7,
        )
        return resp.choices[0].message.content or "No response generated."

    try:
        return await asyncio.to_thread(_openai_call)
    except Exception as e:
        return f"Error generating response: {e}"

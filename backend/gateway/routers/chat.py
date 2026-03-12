"""
Chat with archive endpoints
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.db.database import get_db
from backend.db.models import ChatMessage, MediaItem
from backend.services.chat_service import answer_with_context
from backend.config.settings import settings

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    max_context_items: int = 5


class ChatResponse(BaseModel):
    response: str
    context_media_ids: List[str]


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    db: Session = Depends(get_db)
):
    """
    Chat with Nexus AI using archive context
    """
    if not settings.GEMINI_API_KEY and not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="No LLM API key configured. Set GEMINI_API_KEY or OPENAI_API_KEY."
        )
    # Save user message
    user_msg = ChatMessage(
        role="user",
        text=request.message
    )
    db.add(user_msg)
    db.commit()
    
    # Get response with context
    try:
        response_text, context_ids = await answer_with_context(
            query=request.message,
            db=db,
            max_context_items=request.max_context_items
        )
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"LLM request failed: {str(e)}"
        )
    
    # Save assistant message
    assistant_msg = ChatMessage(
        role="assistant",
        text=response_text,
        context_media_ids=context_ids
    )
    db.add(assistant_msg)
    db.commit()
    
    return {
        "response": response_text,
        "context_media_ids": context_ids
    }


@router.get("/chat/history")
async def get_chat_history(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """
    Get chat history
    """
    messages = db.query(ChatMessage).order_by(
        ChatMessage.timestamp.desc()
    ).offset(skip).limit(limit).all()
    
    return messages


@router.delete("/chat/history")
async def clear_chat_history(db: Session = Depends(get_db)):
    """
    Clear all chat history
    """
    count = db.query(ChatMessage).delete()
    db.commit()
    
    return {"status": "cleared", "messages_deleted": count}

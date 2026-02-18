"""
Gemini service for AI enrichment (summary, tags)
"""
from typing import Dict, List, Optional
import json
from google import genai
from google.genai import types
from tenacity import retry, stop_after_attempt, wait_exponential

from backend.config.settings import settings


class GeminiService:
    """Google Gemini service for text enrichment"""
    
    def __init__(self):
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self.model = settings.GEMINI_MODEL
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=2, max=10)
    )
    def enrich_transcript(self, text: str) -> Dict[str, any]:
        """
        Analyze transcript and generate summary + tags
        
        Returns:
            dict: {
                'ai_summary': str,
                'tags': list[str]
            }
        """
        prompt = f"""ANALYZE THE FOLLOWING TRANSCRIPT:

"{text}"

TASKS:
1. Create a concise, informative summary (max 3 sentences).
2. Extract 3-5 relevant hashtags that capture the main topics.
3. If the text contains a dialogue, try to identify speaker roles.

RETURN ONLY JSON with this structure:
{{
    "aiSummary": "summary text here",
    "tags": ["tag1", "tag2", "tag3"]
}}
"""
        
        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        
        response_text = getattr(response, "text", None) or "{}"
        result = json.loads(response_text)
        
        return {
            'ai_summary': result.get('aiSummary', ''),
            'tags': result.get('tags', [])
        }
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=2, max=10)
    )
    def answer_question(self, question: str, context: str) -> str:
        """
        Answer question using context from archive
        """
        prompt = f"""CONTEXT FROM ARCHIVE:
{context}

USER QUESTION: {question}

Answer the question using the provided context. If the context doesn't contain enough information, use your knowledge but mention the limitation.
"""
        
        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt
        )
        
        return getattr(response, "text", None) or "I couldn't process that request."

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=2, max=10)
    )
    def extract_feed_items(
        self,
        source_title: str,
        content: str,
        prompt: Optional[str],
        period_days: int
    ) -> List[Dict[str, any]]:
        """
        Extract structured items from content using a prompt and time window.

        Returns:
            list of items: {
                'title': str,
                'url': str,
                'date': str,
                'summary': str,
                'tags': list[str]
            }
        """
        trimmed = content[:20000]
        prompt_text = (prompt or '').strip() or 'Extract the most important updates.'
        extraction_prompt = f"""SOURCE: {source_title}

USER INTENT:
{prompt_text}

TIME WINDOW:
Only include items from the last {period_days} days. If date is missing, include only if clearly recent.

CONTENT:
{trimmed}

TASK:
Extract distinct items (news, posts, releases, changes) that match the user intent.
Return 3-10 items. Be precise and avoid boilerplate like menus or footer text.

RETURN ONLY JSON with this structure:
{{
  "items": [
    {{
      "title": "...",
      "url": "...",
      "date": "YYYY-MM-DD",
      "summary": "...",
      "tags": ["tag1", "tag2"]
    }}
  ]
}}
"""

        response = self.client.models.generate_content(
            model=self.model,
            contents=extraction_prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )

        response_text = getattr(response, "text", None) or "{}"
        result = json.loads(response_text)
        items = result.get('items', [])
        if not isinstance(items, list):
            return []
        return items

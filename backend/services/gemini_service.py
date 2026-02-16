"""
Gemini service for AI enrichment (summary, tags)
"""
from typing import Dict, List
import google.generativeai as genai
from tenacity import retry, stop_after_attempt, wait_exponential
import json

from backend.config.settings import settings


class GeminiService:
    """Google Gemini service for text enrichment"""
    
    def __init__(self):
        genai.configure(api_key=settings.GEMINI_API_KEY)
        self.model = genai.GenerativeModel('gemini-1.5-flash')
    
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
        
        response = self.model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json"
            )
        )
        
        result = json.loads(response.text or '{}')
        
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
        
        response = self.model.generate_content(prompt)
        
        return response.text or "I couldn't process that request."

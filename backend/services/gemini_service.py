"""
AI enrichment service (summary, tags) — backed by OpenAI-compatible API.

The class is intentionally named GeminiService to keep all existing call-sites
unchanged; internally it uses the OpenAI SDK pointed at the configured base URL.
"""
from typing import Dict, List, Optional
import json
import os
from openai import OpenAI
from tenacity import retry, stop_after_attempt, wait_exponential
from backend.config.settings import settings


class GeminiService:
    """AI enrichment service using OpenAI-compatible API."""

    def __init__(self):
        self.client = OpenAI(
            api_key=settings.OPENAI_API_KEY,
            base_url=getattr(settings, "OPENAI_BASE_URL", None) or os.environ.get("OPENAI_BASE_URL"),
        )
        self.model = getattr(settings, "OPENAI_MODEL", None) or "gpt-4.1-mini"

    def _chat(self, prompt: str, json_mode: bool = False) -> str:
        kwargs: dict = dict(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
        )
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        response = self.client.chat.completions.create(**kwargs)
        return response.choices[0].message.content or ""

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=2, max=10))
    def enrich_transcript(self, text: str) -> Dict[str, object]:
        prompt = f"""ANALYZE THE FOLLOWING TEXT:
\"\"\"{text[:8000]}\"\"\"

TASKS:
1. Create a concise, informative summary (max 3 sentences).
2. Extract 3-5 relevant hashtags that capture the main topics.

RETURN ONLY JSON:
{{
    "aiSummary": "summary text here",
    "tags": ["tag1", "tag2", "tag3"]
}}
"""
        raw = self._chat(prompt, json_mode=True)
        try:
            result = json.loads(raw)
        except json.JSONDecodeError:
            result = {}
        return {
            "ai_summary": result.get("aiSummary", ""),
            "tags": result.get("tags", []),
        }

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=2, max=10))
    def answer_question(self, question: str, context: str) -> str:
        prompt = f"""CONTEXT FROM ARCHIVE:
{context}

USER QUESTION: {question}

Answer the question using the provided context. If the context does not contain
enough information, use your knowledge but mention the limitation.
"""
        return self._chat(prompt)

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=2, max=10))
    def extract_feed_items(
        self,
        source_title: str,
        content: str,
        prompt: Optional[str],
        period_days: int,
    ) -> List[Dict[str, object]]:
        trimmed = content[:20000]
        prompt_text = (prompt or "").strip() or "Extract the most important updates."
        extraction_prompt = f"""SOURCE: {source_title}
USER INTENT: {prompt_text}
TIME WINDOW: Only include items from the last {period_days} days.
CONTENT:
{trimmed}

Extract 3-10 distinct items. Return ONLY JSON:
{{
  "items": [
    {{"title": "...", "url": "...", "date": "YYYY-MM-DD", "summary": "...", "tags": ["tag1"]}}
  ]
}}
"""
        raw = self._chat(extraction_prompt, json_mode=True)
        try:
            result = json.loads(raw)
        except json.JSONDecodeError:
            return []
        items = result.get("items", [])
        return items if isinstance(items, list) else []

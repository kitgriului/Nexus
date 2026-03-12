"""
Web content extraction service.

Pipeline:
  User URL
    → Load page (Playwright for JS-heavy sites, trafilatura.fetch_url as fallback)
    → Extract text (Trafilatura)
    → (Optional) Intelligent analysis (LLM) — done downstream in Celery task
    → Structured data returned to caller

Playwright is used when:
  - trafilatura.fetch_url returns nothing, or
  - the extracted text is suspiciously short (< 200 chars)
"""
from __future__ import annotations

import re
from typing import Dict, List, Optional
from urllib.parse import urljoin, urlparse

import feedparser
import trafilatura
from trafilatura.metadata import extract_metadata


class WebExtractor:
    """Extract text content from web pages and RSS/Atom feeds."""

    def extract(self, url: str) -> Dict:
        if self._is_feed(url):
            return self._extract_feed(url)
        return self._extract_page(url)

    def _is_feed(self, url: str) -> bool:
        path = urlparse(url).path.lower()
        return path.endswith('.xml') or 'rss' in path or 'feed' in path

    def _extract_feed(self, url: str) -> Dict:
        feed = feedparser.parse(url)
        entries = feed.entries[:20]
        title = feed.feed.get('title') or url

        parts: List[str] = []
        structured_entries: List[Dict] = []

        for entry in entries:
            entry_title = entry.get('title') or ''
            entry_summary = entry.get('summary') or entry.get('description') or ''
            entry_link = entry.get('link') or ''
            entry_date = entry.get('published') or entry.get('updated') or ''
            parts.append(f"{entry_title}\n{entry_summary}".strip())
            structured_entries.append({
                'title': entry_title,
                'summary': entry_summary,
                'url': entry_link,
                'date': entry_date,
            })

        text = "\n\n".join([p for p in parts if p])
        if not text:
            raise ValueError("Feed has no readable entries")

        return {'title': title, 'text': text, 'entries': structured_entries}

    def _extract_page(self, url: str) -> Dict:
        # 1. Try trafilatura (fast, no JS)
        downloaded: Optional[str] = None
        extracted: Optional[str] = None

        try:
            downloaded = trafilatura.fetch_url(url)
        except Exception:
            pass

        if downloaded:
            feed_url = self._discover_feed_url(downloaded, url)
            if feed_url:
                try:
                    return self._extract_feed(feed_url)
                except Exception:
                    pass
            extracted = trafilatura.extract(
                downloaded, include_comments=False, include_tables=False
            )

        # 2. Fall back to Playwright if trafilatura yielded nothing useful
        if not extracted or len(extracted) < 200:
            playwright_text = self._extract_with_playwright(url)
            if playwright_text and len(playwright_text) > len(extracted or ''):
                extracted = playwright_text

        if not extracted:
            raise ValueError("Failed to extract readable text from URL")

        title = url
        if downloaded:
            metadata = extract_metadata(downloaded)
            if metadata and metadata.title:
                title = metadata.title

        return {'title': title, 'text': extracted}

    def _extract_with_playwright(self, url: str) -> Optional[str]:
        """
        Use Playwright (headless Chromium) to render JS-heavy pages and then
        pass the rendered HTML through Trafilatura.
        Returns None if Playwright is not installed or the page fails to load.
        """
        try:
            from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
        except ImportError:
            return None

        html: Optional[str] = None
        title_from_page: Optional[str] = None
        try:
            with sync_playwright() as pw:
                browser = pw.chromium.launch(
                    headless=True,
                    args=[
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu',
                    ]
                )
                context = browser.new_context(
                    user_agent=(
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/122.0.0.0 Safari/537.36"
                    )
                )
                page = context.new_page()
                page.goto(url, wait_until='domcontentloaded', timeout=30_000)
                try:
                    page.wait_for_load_state('networkidle', timeout=8_000)
                except PWTimeout:
                    pass
                html = page.content()
                title_from_page = page.title()
                browser.close()
        except Exception as e:
            return None

        if not html:
            return None

        extracted = trafilatura.extract(html, include_comments=False, include_tables=False)
        return extracted

    def _discover_feed_url(self, html: str, base_url: str) -> Optional[str]:
        if not html:
            return None
        link_tags = re.findall(r"<link[^>]+>", html, flags=re.IGNORECASE)
        for tag in link_tags:
            if not re.search(r"rel=[\"']alternate[\"']", tag, flags=re.IGNORECASE):
                continue
            if not re.search(
                r"type=[\"']application/(rss|atom)\+xml[\"']", tag, flags=re.IGNORECASE
            ):
                continue
            href_match = re.search(r"href=[\"']([^\"']+)[\"']", tag, flags=re.IGNORECASE)
            if not href_match:
                continue
            return urljoin(base_url, href_match.group(1))
        return None

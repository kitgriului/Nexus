"""
Web content extraction service (articles/RSS)
"""
from typing import Dict, List, Optional
from urllib.parse import urljoin, urlparse
import re

import feedparser
import trafilatura
from trafilatura.metadata import extract_metadata


class WebExtractor:
    """Extract text content from web pages and feeds"""

    def extract(self, url: str) -> Dict[str, any]:
        if self._is_feed(url):
            return self._extract_feed(url)
        return self._extract_page(url)

    def _is_feed(self, url: str) -> bool:
        path = urlparse(url).path.lower()
        return path.endswith('.xml') or 'rss' in path or 'feed' in path

    def _extract_feed(self, url: str) -> Dict[str, any]:
        feed = feedparser.parse(url)
        entries = feed.entries[:20]

        title = feed.feed.get('title') or url
        parts: List[str] = []
        structured_entries: List[Dict[str, any]] = []
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
            raise Exception("Feed has no readable entries")

        return {
            'title': title,
            'text': text,
            'entries': structured_entries,
        }

    def _extract_page(self, url: str) -> Dict[str, any]:
        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            raise Exception("Failed to fetch URL")

        feed_url = self._discover_feed_url(downloaded, url)
        if feed_url:
            try:
                return self._extract_feed(feed_url)
            except Exception:
                # Fallback to page extraction if feed parsing fails
                pass

        extracted = trafilatura.extract(downloaded, include_comments=False, include_tables=False)
        if not extracted:
            raise Exception("Failed to extract readable text")

        metadata = extract_metadata(downloaded)
        title = metadata.title if metadata and metadata.title else url
        return {
            'title': title,
            'text': extracted,
        }

    def _discover_feed_url(self, html: str, base_url: str) -> Optional[str]:
        if not html:
            return None
        link_tags = re.findall(r"<link[^>]+>", html, flags=re.IGNORECASE)
        for tag in link_tags:
            if not re.search(r"rel=[\"']alternate[\"']", tag, flags=re.IGNORECASE):
                continue
            if not re.search(r"type=[\"']application/(rss|atom)\+xml[\"']", tag, flags=re.IGNORECASE):
                continue
            href_match = re.search(r"href=[\"']([^\"']+)[\"']", tag, flags=re.IGNORECASE)
            if not href_match:
                continue
            return urljoin(base_url, href_match.group(1))
        return None

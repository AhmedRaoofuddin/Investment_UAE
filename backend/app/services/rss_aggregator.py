"""
RSS / Atom feed aggregator.

Fetches a curated list of MENA + global business/tech feeds in parallel,
parses entries, normalises timestamps, deduplicates by URL hash, and
returns a flat list of articles within the configured lookback window.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

import feedparser
import httpx
import yaml
from dateutil import parser as dateparser
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import DATA_DIR, get_settings
from app.models.schemas import SourceArticle


logger = logging.getLogger(__name__)


@dataclass
class FeedSource:
    name: str
    url: str
    region: str
    weight: float = 1.0
    tags: List[str] = field(default_factory=list)


def load_sources() -> List[FeedSource]:
    """Read sources.yaml and flatten into a list of FeedSource."""
    path = DATA_DIR / "sources.yaml"
    with path.open("r", encoding="utf-8") as f:
        raw = yaml.safe_load(f)

    sources: List[FeedSource] = []
    for group in raw.values():
        for entry in group:
            sources.append(
                FeedSource(
                    name=entry["name"],
                    url=entry["url"],
                    region=entry.get("region", "Global"),
                    weight=float(entry.get("weight", 1.0)),
                    tags=entry.get("tags", []) or [],
                )
            )
    return sources


def _stable_id(url: str) -> str:
    return hashlib.sha1(url.encode("utf-8")).hexdigest()[:16]


def _safe_parse_date(raw: Optional[str]) -> Optional[datetime]:
    if not raw:
        return None
    try:
        dt = dateparser.parse(raw)
        if dt and dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, TypeError, OverflowError):
        return None


def _extract_image_url(entry, summary_html: Optional[str]) -> Optional[str]:
    """Best-effort lead-image extraction from a feedparser entry.

    Checks, in priority order:
      1. media:content (MRSS) — first item with medium=image OR an image/*
         MIME type, or the first item period if none declare a medium.
      2. media:thumbnail (MRSS).
      3. <enclosure> tags with an image/* type.
      4. First <img src="..."> inside the summary/description HTML.

    Returns None if none of those produce a usable http(s) URL. The result
    is not validated against a HEAD request — that would 50x the latency of
    a pipeline run. The frontend hides images that fail to load via
    onError, so a dead URL just degrades to "no image".
    """
    # 1 + 2: feedparser's MRSS shape is `media_content` / `media_thumbnail`,
    # each a list of {'url': ..., 'type': ..., 'medium': ...} dicts.
    for attr in ("media_content", "media_thumbnail"):
        items = entry.get(attr) or []
        if not isinstance(items, list):
            continue
        # Prefer items explicitly marked as image, then fall back to the
        # first one. Some feeds (e.g. some podcasts) put videos in
        # media_content, so the medium/type check is worth doing.
        preferred = [
            it for it in items
            if isinstance(it, dict)
            and (
                (it.get("medium") or "").lower() == "image"
                or (it.get("type") or "").lower().startswith("image/")
            )
        ]
        for it in preferred or items:
            if isinstance(it, dict):
                url = (it.get("url") or "").strip()
                if url.startswith(("http://", "https://")):
                    return url

    # 3: <enclosure>. feedparser exposes this as `links` with rel=enclosure,
    # or as `enclosures`.
    enclosures = entry.get("enclosures") or []
    if isinstance(enclosures, list):
        for enc in enclosures:
            if isinstance(enc, dict):
                etype = (enc.get("type") or "").lower()
                href = (enc.get("href") or enc.get("url") or "").strip()
                if href.startswith(("http://", "https://")) and (
                    etype.startswith("image/")
                    or href.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".gif"))
                ):
                    return href

    # 4: first <img> inside the summary HTML. We only reach this if the
    # upstream feed didn't provide any MRSS/enclosure fields at all.
    if summary_html:
        try:
            from bs4 import BeautifulSoup

            soup = BeautifulSoup(summary_html, "lxml")
            for img in soup.find_all("img"):
                src = (img.get("src") or img.get("data-src") or "").strip()
                if src.startswith(("http://", "https://")):
                    return src
        except (ImportError, ValueError):
            return None

    return None


_BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)


@retry(stop=stop_after_attempt(2), wait=wait_exponential(min=1, max=4), reraise=False)
async def _fetch_one(client: httpx.AsyncClient, source: FeedSource) -> List[SourceArticle]:
    """Fetch a single feed; return a list of normalised articles."""
    try:
        resp = await client.get(
            source.url,
            timeout=20.0,
            headers={
                "User-Agent": _BROWSER_UA,
                "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
                "Accept-Language": "en-US,en;q=0.9",
                "Cache-Control": "no-cache",
            },
            follow_redirects=True,
        )
        resp.raise_for_status()
    except (httpx.HTTPError, httpx.TimeoutException) as exc:
        logger.warning("feed_fetch_failed source=%s err=%s", source.name, exc)
        return []

    parsed = feedparser.parse(resp.content)
    settings = get_settings()
    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.lookback_days)

    out: List[SourceArticle] = []
    for entry in parsed.entries[: settings.max_articles_per_feed]:
        url = entry.get("link") or entry.get("id")
        title = (entry.get("title") or "").strip()
        if not url or not title:
            continue

        published = _safe_parse_date(
            entry.get("published") or entry.get("updated") or entry.get("created")
        )
        if published and published < cutoff:
            continue

        raw_summary_html = entry.get("summary") or entry.get("description") or ""
        # Plain-text summary for downstream NLP agents.
        summary: Optional[str] = None
        if raw_summary_html:
            from bs4 import BeautifulSoup

            summary = BeautifulSoup(raw_summary_html, "lxml").get_text(" ", strip=True)[:1200]

        image_url = _extract_image_url(entry, raw_summary_html or None)

        out.append(
            SourceArticle(
                title=title[:400],
                url=url,
                source_name=source.name,
                source_region=source.region,
                published_at=published,
                summary=summary or None,
                image_url=image_url,
            )
        )
    return out


# User-Agent rotation for og:image scraping. Many publishers (Finextra,
# some Bloomberg properties, WSJ) return 403 to generic Chrome UAs but
# whitelist `facebookexternalhit` and `Twitterbot` specifically because
# they want their articles to render as rich embeds on those platforms.
# We try Facebook first (highest success rate across MENA publishers),
# then Twitterbot, then a vanilla Chrome UA as a last resort.
_OG_SCRAPE_UAS = (
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "Mozilla/5.0 (compatible; Twitterbot/1.0)",
    _BROWSER_UA,
)


async def _scrape_og_image(client: httpx.AsyncClient, article_url: str) -> Optional[str]:
    """Fetch an article page and extract its Open Graph / Twitter lead image.

    Direct-publisher RSS feeds often don't embed image URLs in the feed
    body, so we fall back to scraping the article page's
    `<meta property="og:image">` (or twitter:image, or <link rel="image_src">).

    We rotate through three User-Agents because some publishers (Finextra,
    certain Bloomberg properties) only surface the full HTML for social-
    media crawler UAs — a generic Chrome UA gets a 403 / captcha wall.
    Stops at the first UA that returns 2xx.
    """
    head_html: Optional[str] = None
    for ua in _OG_SCRAPE_UAS:
        try:
            resp = await client.get(
                article_url,
                timeout=5.0,
                headers={
                    "User-Agent": ua,
                    "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9",
                },
                follow_redirects=True,
            )
            if resp.status_code < 400:
                # Cap parse to the first 120 KB — <head> is always near the
                # top and full-article HTML can be multi-MB on some outlets.
                head_html = resp.text[:120_000]
                break
        except (httpx.HTTPError, httpx.TimeoutException):
            continue

    if head_html is None:
        return None

    try:
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(head_html, "lxml")
    except (ImportError, ValueError):
        return None

    # Priority: og:image → og:image:url → twitter:image → link rel=image_src
    for selector in (
        ('meta', {'property': 'og:image'}),
        ('meta', {'property': 'og:image:url'}),
        ('meta', {'name': 'og:image'}),
        ('meta', {'name': 'twitter:image'}),
        ('meta', {'property': 'twitter:image'}),
    ):
        tag = soup.find(*selector)
        if tag and tag.get("content"):
            url = tag.get("content", "").strip()
            if url.startswith(("http://", "https://")):
                return url

    link = soup.find("link", rel="image_src")
    if link and link.get("href"):
        url = link.get("href", "").strip()
        if url.startswith(("http://", "https://")):
            return url

    return None


async def _enrich_with_og_images(articles: List[SourceArticle]) -> None:
    """For articles without a feed-level image, fetch og:image in parallel.

    Mutates the article list in place. Bounded to 12 concurrent fetches and
    a 25 s global budget so the enrichment step can't starve the pipeline.
    Articles that time out or 4xx simply keep image_url=None and render as
    text-only cards on the frontend.
    """
    needing = [a for a in articles if not a.image_url]
    if not needing:
        return

    settings = get_settings()
    # Reuse the feed-fetch concurrency; don't spawn a separate pool.
    sem = asyncio.Semaphore(max(8, settings.parallel_fetches))

    async with httpx.AsyncClient(http2=False) as client:
        async def _one(article: SourceArticle) -> None:
            async with sem:
                img = await _scrape_og_image(client, article.url)
                if img:
                    article.image_url = img

        try:
            await asyncio.wait_for(
                asyncio.gather(*(_one(a) for a in needing), return_exceptions=True),
                timeout=25.0,
            )
        except asyncio.TimeoutError:
            logger.warning(
                "og_image_enrich_timeout fetched=%d of=%d",
                sum(1 for a in needing if a.image_url),
                len(needing),
            )


async def fetch_all_articles() -> List[SourceArticle]:
    """Fan-out fetch across every source, deduplicate by URL hash."""
    settings = get_settings()
    sources = load_sources()
    semaphore = asyncio.Semaphore(settings.parallel_fetches)

    async with httpx.AsyncClient(http2=False) as client:
        async def _bounded(src: FeedSource) -> List[SourceArticle]:
            async with semaphore:
                return await _fetch_one(client, src)

        results = await asyncio.gather(*(_bounded(s) for s in sources), return_exceptions=True)

    seen: Dict[str, SourceArticle] = {}
    for r in results:
        if isinstance(r, Exception):
            logger.warning("feed_task_exception err=%s", r)
            continue
        for article in r:
            seen.setdefault(_stable_id(article.url), article)

    articles = list(seen.values())
    articles.sort(
        key=lambda a: a.published_at or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )

    # Enrich the freshest articles with og:image when the RSS feed didn't
    # include one. Scoped to the top 150 freshest articles so we cover the
    # candidate set the classifier is likely to promote to signals but
    # don't blow the lambda timeout on back-catalogue entries.
    await _enrich_with_og_images(articles[:150])

    with_image = sum(1 for a in articles if a.image_url)
    logger.info(
        "feed_aggregation_done sources=%d articles=%d with_image=%d",
        len(sources),
        len(articles),
        with_image,
    )
    return articles

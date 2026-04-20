"""
Public API routes consumed by the Next.js frontend.
"""
from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.config import get_settings
from app.models.schemas import (
    CompaniesResponse,
    Company,
    CompanyDeepDive,
    GeoPoint,
    GeoResponse,
    HealthResponse,
    Sector,
    SectorAggregate,
    SectorsResponse,
    Signal,
    SignalStrength,
    SignalType,
)
from app.services.claude_signal_extractor import deep_dive_company
from app.services.daily_digest import build_digest
from app.services.pipeline import get_companies, run_pipeline
from app.services.pipeline_cache import cache


router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    companies, _gen, _ms = cache.get()
    return HealthResponse(
        status="ok",
        version="1.0.0",
        cache_age_minutes=cache.age_minutes(),
        cached_companies=len(companies or []),
    )


@router.post("/refresh")
async def refresh() -> dict:
    """Force a full pipeline run. Slow — intended for ops/admin use."""
    started = datetime.now(timezone.utc)
    companies = await run_pipeline()
    return {
        "ok": True,
        "started_at": started.isoformat(),
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "company_count": len(companies),
    }


@router.get("/digest")
async def digest(
    limit: int = Query(10, ge=1, le=50),
    window_hours: int = Query(24, ge=1, le=168),
) -> dict:
    """Daily digest: the top-N companies seen in the rolling window,
    ordered by composite score. Consumed by the daily cron job that
    dispatches the digest through tenant notification channels."""
    companies = build_digest(limit=limit, window_hours=window_hours)
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "window_hours": window_hours,
        "count": len(companies),
        "items": [c.model_dump(mode="json") for c in companies],
    }


# In-memory cache for on-demand og:image lookups. Keyed by URL, value
# is the resolved image URL (or None on miss). Process-local — restarts
# with the serverless function, which is fine because the full pipeline
# cache will backfill image_url on next refresh anyway.
_OG_CACHE: dict[str, Optional[str]] = {}


@router.get("/og-image")
async def og_image(url: str = Query(..., min_length=10, max_length=2000)) -> dict:
    """Scrape og:image for a single article URL.

    The pipeline enrichment pass covers the freshest 150 articles but its
    global time budget means some direct-publisher articles (Wamda,
    MAGNiTT, AGBI) miss their image. The frontend calls this endpoint
    lazily for any signal card whose feed didn't carry an image_url, so
    the media wall fills in progressively after paint without blocking
    the pipeline.
    """
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="invalid url")

    if url in _OG_CACHE:
        return {"url": url, "image_url": _OG_CACHE[url]}

    # Inline import to avoid coupling routers to the aggregator helpers
    # module at import time.
    import httpx as _httpx
    from app.services.rss_aggregator import _scrape_og_image  # type: ignore

    async with _httpx.AsyncClient(http2=False) as client:
        img = await _scrape_og_image(client, url)

    _OG_CACHE[url] = img
    return {"url": url, "image_url": img}


def _filter_company(
    c: Company,
    *,
    sector: Optional[Sector],
    region: Optional[str],
    min_score: float,
    signal_type: Optional[SignalType],
    strength: Optional[SignalStrength],
    query: Optional[str],
) -> bool:
    if sector and sector not in c.sectors:
        return False
    if region:
        # Region match against either HQ country or any expansion target
        regions = []
        if c.headquarters and c.headquarters.country_code:
            regions.append(c.headquarters.country_code)
        for t in c.expansion_targets:
            if t.country_code:
                regions.append(t.country_code)
        if region.upper() not in {r.upper() for r in regions}:
            return False
    avg = (c.investability_score + c.uae_alignment_score) / 2
    if avg < min_score:
        return False
    if signal_type and not any(s.type == signal_type for s in c.signals):
        return False
    if strength and not any(s.strength == strength for s in c.signals):
        return False
    if query:
        q = query.lower()
        haystack = " ".join(
            [
                c.name.lower(),
                (c.description or "").lower(),
                " ".join(a.lower() for a in c.aliases),
            ]
        )
        if q not in haystack:
            return False
    return True


@router.get("/companies", response_model=CompaniesResponse)
async def list_companies(
    sector: Optional[Sector] = None,
    region: Optional[str] = Query(None, description="ISO-2 country code, e.g. AE"),
    min_score: float = Query(0.0, ge=0.0, le=100.0),
    signal_type: Optional[SignalType] = None,
    strength: Optional[SignalStrength] = None,
    query: Optional[str] = Query(None, alias="q"),
    limit: int = Query(60, ge=1, le=200),
) -> CompaniesResponse:
    companies = await get_companies()
    filtered = [
        c
        for c in companies
        if _filter_company(
            c,
            sector=sector,
            region=region,
            min_score=min_score,
            signal_type=signal_type,
            strength=strength,
            query=query,
        )
    ]
    _, generated, run_ms = cache.get()
    return CompaniesResponse(
        generated_at=generated or datetime.now(timezone.utc),
        pipeline_run_ms=run_ms,
        total=len(filtered),
        items=filtered[:limit],
    )


@router.get("/companies/{company_id}", response_model=CompanyDeepDive)
async def company_detail(company_id: str) -> CompanyDeepDive:
    companies = await get_companies()
    company = next((c for c in companies if c.id == company_id), None)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    thesis, risks, next_actions = await deep_dive_company(company)
    # Build related-signals with URL-level deduplication. Two different
    # companies can extract the SAME underlying article (e.g. "Aramco
    # backs Via Separations" surfaces against both the Aramco and the
    # Via Separations company records, each with its own signal id).
    # Deduplicating by signal.id alone misses this case; URL dedup
    # collapses them so a reviewer never sees the same headline twice.
    related: list[Signal] = []
    seen_keys: set[str] = set()
    # Also skip signals whose URL already appears in the subject
    # company's own signal list — those would be shown twice on the
    # dossier page (once in Signal Timeline, once in Related).
    for s in company.signals:
        seen_keys.add((s.source.url or s.source.source_name or s.id).lower())
    if company.sectors:
        for c in companies:
            if c.id == company.id:
                continue
            if not any(s in company.sectors for s in c.sectors):
                continue
            for s in c.signals[:3]:
                key = (s.source.url or s.source.source_name or s.id).lower()
                if key in seen_keys:
                    continue
                seen_keys.add(key)
                related.append(s)
                if len(related) >= 8:
                    break
            if len(related) >= 8:
                break

    return CompanyDeepDive(
        company=company,
        investment_thesis=thesis,
        risks=risks,
        next_actions=next_actions,
        related_signals=related[:8],
    )


@router.get("/sectors", response_model=SectorsResponse)
async def sectors_breakdown() -> SectorsResponse:
    companies = await get_companies()
    by_sector: dict[Sector, list[Company]] = defaultdict(list)
    for c in companies:
        for s in c.sectors:
            by_sector[s].append(c)

    items: list[SectorAggregate] = []
    for sector, cos in by_sector.items():
        signal_count = sum(len(c.signals) for c in cos)
        avg_score = (
            sum((c.investability_score + c.uae_alignment_score) / 2 for c in cos) / max(1, len(cos))
        )
        cos_sorted = sorted(
            cos,
            key=lambda c: (c.investability_score + c.uae_alignment_score) / 2,
            reverse=True,
        )
        items.append(
            SectorAggregate(
                sector=sector,
                company_count=len(cos),
                signal_count=signal_count,
                avg_score=round(avg_score, 1),
                top_companies=[c.name for c in cos_sorted[:5]],
            )
        )
    items.sort(key=lambda x: x.company_count, reverse=True)
    return SectorsResponse(generated_at=datetime.now(timezone.utc), items=items)


@router.get("/geo", response_model=GeoResponse)
async def geo_points() -> GeoResponse:
    companies = await get_companies()
    points: list[GeoPoint] = []
    for c in companies:
        score = (c.investability_score + c.uae_alignment_score) / 2
        if c.headquarters and c.headquarters.lat is not None and c.headquarters.lng is not None:
            points.append(
                GeoPoint(
                    company_id=c.id,
                    company_name=c.name,
                    lat=c.headquarters.lat,
                    lng=c.headquarters.lng,
                    intent="headquarters",
                    score=score,
                    sectors=c.sectors,
                )
            )
        for t in c.expansion_targets:
            if t.lat is not None and t.lng is not None:
                points.append(
                    GeoPoint(
                        company_id=c.id,
                        company_name=c.name,
                        lat=t.lat,
                        lng=t.lng,
                        intent="expansion_target",
                        score=score,
                        sectors=c.sectors,
                    )
                )
    return GeoResponse(generated_at=datetime.now(timezone.utc), items=points)

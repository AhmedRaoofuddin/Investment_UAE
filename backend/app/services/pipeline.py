"""
End-to-end orchestrator: feeds -> agent pipeline -> cache.

Supports two pipeline paths:
  1. Agent Pipeline (default): Uses open-source ML agents (embedding, classifier,
     entity extraction, scoring) with optional Claude enhancement.
  2. Claude Pipeline (legacy): Direct Claude API extraction and scoring.

The agent pipeline is preferred as it works without API keys and provides
transparent, reproducible results. Claude is used as an optional enhancement
layer for the top-scoring companies.
"""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timedelta, timezone
from typing import List

from app.models.schemas import Company, Signal
from app.services.pipeline_cache import cache
from app.services.rss_aggregator import fetch_all_articles


logger = logging.getLogger(__name__)
_refresh_lock = asyncio.Lock()


async def run_pipeline(use_agents: bool = True) -> list[Company]:
    """
    Full pipeline run, ignoring cache.

    Args:
        use_agents: If True (default), use the open-source ML agent pipeline.
                    If False, use the legacy Claude-only pipeline.
    """
    started = time.perf_counter()

    # Stage 1: Fetch articles from all RSS sources
    articles = await fetch_all_articles()
    logger.info("pipeline_fetch_complete articles=%d", len(articles))

    if not articles:
        logger.warning("pipeline_no_articles_fetched")
        return []

    # Stage 2: Process through the appropriate pipeline
    if use_agents:
        new_companies = await _run_agent_pipeline(articles)
    else:
        new_companies = await _run_claude_pipeline(articles)

    # Stage 3: Merge with previous cache so each refresh ADDS fresh
    # signals to the rolling pool instead of replacing it. Without this,
    # RSS feeds that publish slowly (i.e. most of them — publishers post
    # 1–5 articles/hour) made every refresh look identical. Merge rule:
    #   • Union companies by id; merge their `signals` lists by id.
    #   • Union all signals within a company, keep the freshest 15.
    #   • Drop signals older than 30 days so the pool doesn't grow
    #     unbounded and the UI's "freshest first" ordering stays useful.
    #   • Preserve newer scoring when Claude enhanced the company this
    #     run; otherwise keep the old score to avoid volatility.
    previous_companies, _prev_gen, _prev_ms = cache.get()
    companies = _merge_snapshots(previous_companies or [], new_companies)

    # Stage 4: Cache results
    elapsed_ms = int((time.perf_counter() - started) * 1000)
    await cache.set(companies, elapsed_ms)
    logger.info(
        "pipeline_complete mode=%s companies=%d new_companies=%d articles=%d elapsed_ms=%d",
        "agents" if use_agents else "claude",
        len(companies),
        len(new_companies),
        len(articles),
        elapsed_ms,
    )

    # Stage 4: Publish to workspace ingest. Best-effort, never raises.
    try:
        from app.services.workspace_publisher import publish_signals_to_workspace
        await publish_signals_to_workspace(companies)
    except Exception as exc:  # noqa: BLE001
        logger.warning("workspace_publish_outer_failed err=%s", exc)

    return companies


def _merge_snapshots(
    previous: List[Company],
    current: List[Company],
) -> List[Company]:
    """Union the previous cache with the current pipeline output.

    - Companies are keyed by `id`; previous entries that don't appear in
      `current` are still kept (the user might have seen them on a
      previous refresh; yanking them mid-session is disorienting).
    - Each company's `signals` list is unioned by signal id; freshest 15
      kept; signals older than 30 days pruned so the pool bounds.
    - Location / sectors / scores from `current` win when a company is in
      both (scoring is more up-to-date).
    - After merge, companies are sorted by composite score desc and
      capped at 200 so the cache stays serialisable within Vercel's
      function-response size limits.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)

    by_id: dict[str, Company] = {c.id: c for c in previous}
    for c in current:
        existing = by_id.get(c.id)
        if not existing:
            by_id[c.id] = c
            continue
        # Union signals by id. Current wins on any field conflict.
        all_signals: dict[str, Signal] = {s.id: s for s in existing.signals}
        for s in c.signals:
            all_signals[s.id] = s
        merged_signals = [
            s for s in all_signals.values()
            if (s.detected_at is None or s.detected_at >= cutoff)
        ]
        merged_signals.sort(
            key=lambda s: s.detected_at or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )
        # Replace the company wholesale so the latest scoring / sectors /
        # HQ location win, but preserve the merged signals list.
        c.signals = merged_signals[:15]
        # Aliases accumulate across runs — the article-level entity
        # extractor sometimes catches a name variant only in a later
        # fetch (e.g. "PIF-backed Humain" vs "Humain").
        existing_aliases = set(existing.aliases)
        for a in c.aliases:
            existing_aliases.add(a)
        c.aliases = sorted(existing_aliases)
        # Take the earliest first_seen and the latest last_seen across
        # the two observations.
        if existing.first_seen and c.first_seen:
            c.first_seen = min(existing.first_seen, c.first_seen)
        if existing.last_seen and c.last_seen:
            c.last_seen = max(existing.last_seen, c.last_seen)
        by_id[c.id] = c

    companies = list(by_id.values())
    # Drop companies whose every signal has aged out.
    companies = [c for c in companies if any(
        (s.detected_at is None or s.detected_at >= cutoff) for s in c.signals
    )]
    companies.sort(
        key=lambda c: (c.investability_score + c.uae_alignment_score) / 2,
        reverse=True,
    )
    return companies[:200]


async def _run_agent_pipeline(articles) -> list[Company]:
    """Run the open-source ML agent pipeline."""
    try:
        from app.agents.orchestrator import PipelineOrchestrator
        orchestrator = PipelineOrchestrator()
        return await orchestrator.run(articles)
    except Exception as exc:
        logger.error("agent_pipeline_failed err=%s, falling back to claude", exc)
        return await _run_claude_pipeline(articles)


async def _run_claude_pipeline(articles) -> list[Company]:
    """Run the legacy Claude API pipeline."""
    try:
        from app.services.claude_signal_extractor import extract_signals_and_companies
        return await extract_signals_and_companies(articles)
    except Exception as exc:
        logger.error("claude_pipeline_failed err=%s", exc)
        return []


async def get_companies(force_refresh: bool = False) -> list[Company]:
    """Cached fetch with optional force-refresh."""
    if not force_refresh:
        companies, _gen, _ms = cache.get()
        if companies and cache.is_fresh():
            return companies

    async with _refresh_lock:
        # Re-check after acquiring lock (someone else may have refreshed)
        if not force_refresh:
            companies, _gen, _ms = cache.get()
            if companies and cache.is_fresh():
                return companies
        return await run_pipeline()

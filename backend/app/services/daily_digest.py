"""Daily digest builder.

Produces the top-N high-conviction companies detected in the last 24 hours,
ordered by composite score. Used by the daily 06:00 UTC cron to assemble
the ministerial pipeline handed to analysts.

Pure over the cached pipeline snapshot. Never runs the full pipeline again
and never calls an external service. Safe to invoke from a cron endpoint.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List

from app.models.schemas import Company, Signal
from app.services.pipeline_cache import cache


def build_digest(limit: int = 10, window_hours: int = 24) -> List[Company]:
    """Return the top-N companies that saw at least one fresh signal
    inside the rolling window.

    Companies are ranked by composite score (average of investability and
    UAE alignment). Within each company, signals outside the window are
    dropped from the returned payload so the digest is tightly focused on
    "what changed today".
    """
    companies, _gen, _ms = cache.get()
    if not companies:
        return []

    cutoff = datetime.now(timezone.utc) - timedelta(hours=window_hours)

    digest: List[Company] = []
    for c in companies:
        fresh = [s for s in c.signals if _is_fresh(s, cutoff)]
        if not fresh:
            continue
        trimmed = c.model_copy(update={"signals": fresh})
        digest.append(trimmed)

    digest.sort(
        key=lambda c: (c.investability_score + c.uae_alignment_score) / 2,
        reverse=True,
    )
    return digest[:limit]


def _is_fresh(signal: Signal, cutoff: datetime) -> bool:
    detected = signal.detected_at
    if detected.tzinfo is None:
        detected = detected.replace(tzinfo=timezone.utc)
    return detected >= cutoff

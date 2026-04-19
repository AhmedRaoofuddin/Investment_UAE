"""
Workspace publisher.

After every pipeline run, publish the freshest signals to the frontend
workspace ingest endpoint. The ingest endpoint:
  - filters by each tenant's watchlist
  - dedupes on (signal_id, tenantId)
  - writes a Notification row visible to the user

We sign each request with HMAC-SHA256 over the body using the shared
WORKSPACE_INGEST_KEY env var. The frontend rejects unsigned or
incorrectly-signed requests with 401.

Failures here are logged but never raised, because the workspace publish
is a best-effort side effect of the pipeline run, not a blocker for the
demo platform pages.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
from typing import List

import httpx

from app.models.schemas import Company, SignalStrength

logger = logging.getLogger(__name__)


def _ingest_url() -> str | None:
    return os.getenv("WORKSPACE_INGEST_URL")


def _ingest_key() -> str | None:
    return os.getenv("WORKSPACE_INGEST_KEY")


def _strength_to_str(s: SignalStrength) -> str:
    # Pydantic enum to plain lowercase string for JSON.
    return s.value if hasattr(s, "value") else str(s)


def _flatten_signals(companies: List[Company]) -> list[dict]:
    out: list[dict] = []
    for c in companies:
        hq_cc = c.headquarters.country_code if c.headquarters else None
        exp_ccs = [t.country_code for t in c.expansion_targets if t.country_code]
        sectors = [s.value if hasattr(s, "value") else str(s) for s in c.sectors]
        for sig in c.signals:
            out.append(
                {
                    "signal_id": sig.id,
                    "company_id": c.id,
                    "company_name": c.name,
                    "company_aliases": list(c.aliases or []),
                    "sectors": sectors,
                    "hq_country_code": hq_cc,
                    "expansion_country_codes": exp_ccs,
                    "signal_type": sig.type.value if hasattr(sig.type, "value") else str(sig.type),
                    "strength": _strength_to_str(sig.strength),
                    "headline": sig.headline,
                    "rationale": sig.rationale,
                    "source_url": sig.source.url if sig.source else None,
                    "source_name": sig.source.source_name if sig.source else None,
                    "detected_at": sig.detected_at.isoformat() if sig.detected_at else "",
                }
            )
    return out


async def publish_signals_to_workspace(companies: List[Company]) -> None:
    """Best-effort publish. Silent no-op if env not configured."""
    url = _ingest_url()
    key = _ingest_key()
    if not url or not key:
        logger.info("workspace_publish_skipped reason=env-missing")
        return

    signals = _flatten_signals(companies)
    if not signals:
        logger.info("workspace_publish_skipped reason=no-signals")
        return

    body = json.dumps(
        {"signals": signals, "source": "fastapi-pipeline", "generated_at": ""},
        default=str,
    ).encode("utf-8")
    sig = hmac.new(key.encode("utf-8"), body, hashlib.sha256).hexdigest()

    endpoint = url.rstrip("/") + "/api/workspace/ingest"

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                endpoint,
                content=body,
                headers={
                    "content-type": "application/json",
                    "x-ingest-signature": sig,
                },
            )
        if resp.status_code != 200:
            logger.warning(
                "workspace_publish_failed status=%s body=%s",
                resp.status_code,
                resp.text[:200],
            )
        else:
            logger.info("workspace_publish_ok %s", resp.text[:200])
    except Exception as exc:  # noqa: BLE001
        logger.warning("workspace_publish_error err=%s", exc)

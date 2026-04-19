"""
File-backed cache for pipeline results, with TTL.
Avoids re-running the full RSS+Claude pipeline on every API call.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from app.config import CACHE_DIR, get_settings
from app.models.schemas import Company


logger = logging.getLogger(__name__)


class PipelineCache:
    """Single global cache slot for the latest companies snapshot."""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._companies: Optional[List[Company]] = None
        self._generated_at: Optional[datetime] = None
        self._pipeline_run_ms: int = 0
        self._path = CACHE_DIR / "pipeline_snapshot.json"

    async def load_from_disk(self) -> None:
        if not self._path.exists():
            return
        try:
            data = json.loads(self._path.read_text(encoding="utf-8"))
            self._companies = [Company(**c) for c in data.get("items", [])]
            self._generated_at = datetime.fromisoformat(data["generated_at"])
            self._pipeline_run_ms = int(data.get("pipeline_run_ms", 0))
            logger.info(
                "cache_loaded count=%d age_minutes=%d",
                len(self._companies or []),
                self.age_minutes() or -1,
            )
        except (json.JSONDecodeError, KeyError, ValueError) as exc:
            logger.warning("cache_load_failed err=%s", exc)

    def age_minutes(self) -> Optional[int]:
        if not self._generated_at:
            return None
        delta = datetime.now(timezone.utc) - self._generated_at
        return int(delta.total_seconds() / 60)

    def is_fresh(self) -> bool:
        if not self._generated_at:
            return False
        age = self.age_minutes() or 0
        return age < (get_settings().cache_ttl_hours * 60)

    def get(self) -> tuple[Optional[List[Company]], Optional[datetime], int]:
        return self._companies, self._generated_at, self._pipeline_run_ms

    async def set(self, companies: List[Company], pipeline_run_ms: int) -> None:
        async with self._lock:
            self._companies = companies
            self._generated_at = datetime.now(timezone.utc)
            self._pipeline_run_ms = pipeline_run_ms

            payload = {
                "generated_at": self._generated_at.isoformat(),
                "pipeline_run_ms": pipeline_run_ms,
                "items": [c.model_dump(mode="json") for c in companies],
            }
            try:
                self._path.write_text(json.dumps(payload, default=str), encoding="utf-8")
            except OSError as exc:
                logger.warning("cache_write_failed err=%s", exc)


cache = PipelineCache()

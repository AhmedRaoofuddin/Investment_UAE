"""Pipeline cache behaviour.

The cache serves every `GET /api/companies` hit. TTL freshness must be
respected, and the disk snapshot must survive process restart.
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from app.services.pipeline_cache import PipelineCache
from app.models.schemas import Company


pytestmark = pytest.mark.service


def _make_company(cid: str = "co_test") -> Company:
    """Minimal valid Company for cache round-trip tests."""
    now = datetime.now(timezone.utc)
    return Company(
        id=cid,
        name="Test Co",
        aliases=[],
        description="A test entry",
        sectors=["fintech"],
        first_seen=now,
        last_seen=now,
        signals=[],
    )


class TestFreshnessWindow:
    def test_empty_cache_not_fresh(self) -> None:
        c = PipelineCache()
        assert c.is_fresh() is False
        assert c.age_minutes() is None

    def test_fresh_after_set(self, tmp_path, monkeypatch) -> None:
        c = PipelineCache()
        c._path = tmp_path / "snap.json"
        asyncio.run(c.set([_make_company()], pipeline_run_ms=1234))
        assert c.is_fresh() is True
        # Age should be "just now" (0 or 1 minutes). Explicit None-check
        # because `0 or 99` would evaluate to 99 (0 is falsy).
        age = c.age_minutes()
        assert age is not None and age < 2

    def test_stale_after_ttl(self, tmp_path) -> None:
        c = PipelineCache()
        c._path = tmp_path / "snap.json"
        asyncio.run(c.set([_make_company()], pipeline_run_ms=1))
        # Manually rewind the generated_at beyond the TTL
        c._generated_at = datetime.now(timezone.utc) - timedelta(hours=24)
        assert c.is_fresh() is False


class TestDiskRoundTrip:
    def test_disk_snapshot_written_and_reloaded(self, tmp_path) -> None:
        path = tmp_path / "snap.json"
        c1 = PipelineCache()
        c1._path = path
        asyncio.run(c1.set([_make_company("co_a"), _make_company("co_b")], 999))
        assert path.exists()

        # New instance, load from disk
        c2 = PipelineCache()
        c2._path = path
        asyncio.run(c2.load_from_disk())
        companies, _, run_ms = c2.get()
        assert companies is not None
        assert len(companies) == 2
        assert {c.id for c in companies} == {"co_a", "co_b"}
        assert run_ms == 999

    def test_corrupt_disk_snapshot_is_ignored(self, tmp_path) -> None:
        path = tmp_path / "snap.json"
        path.write_text("{not valid json", encoding="utf-8")
        c = PipelineCache()
        c._path = path
        asyncio.run(c.load_from_disk())
        # Should NOT crash; cache stays empty
        assert c.get()[0] is None


class TestConcurrentWrite:
    def test_concurrent_writes_serialize_via_lock(self, tmp_path) -> None:
        c = PipelineCache()
        c._path = tmp_path / "snap.json"

        async def writer(i: int) -> None:
            await c.set([_make_company(f"co_{i}")], pipeline_run_ms=i)

        async def run_all() -> None:
            await asyncio.gather(*(writer(i) for i in range(5)))

        asyncio.run(run_all())
        # Whichever write landed last, exactly one companies list is in state
        companies, _, _ = c.get()
        assert companies is not None
        assert len(companies) == 1

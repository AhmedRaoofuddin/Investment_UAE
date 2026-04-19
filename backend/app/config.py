"""
Application configuration loaded from environment variables.
Pydantic-settings parses .env in development; OS env wins in production.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv


BACKEND_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = BACKEND_ROOT / "data"
CACHE_DIR = BACKEND_ROOT / "cache"

# Load .env exactly once at import time. In dev the local .env fills in keys
# that the shell may not export; in deployed environments (Vercel, Docker, etc.)
# the platform-provided OS env always wins so stale .env files in the bundle
# can't shadow real production secrets.
load_dotenv(BACKEND_ROOT / ".env", override=False)


def _env_str(key: str, default: str = "") -> str:
    return os.getenv(key, default)


def _env_int(key: str, default: int) -> int:
    raw = os.getenv(key)
    if raw is None or raw == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    anthropic_api_key: str
    claude_model_fast: str
    claude_model_deep: str
    lookback_days: int
    max_articles_per_feed: int
    parallel_fetches: int
    cache_ttl_hours: int
    allowed_origin: str
    log_level: str


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return Settings(
        anthropic_api_key=_env_str("ANTHROPIC_API_KEY"),
        claude_model_fast=_env_str("CLAUDE_MODEL_FAST", "claude-haiku-4-5-20251001"),
        claude_model_deep=_env_str("CLAUDE_MODEL_DEEP", "claude-opus-4-6"),
        lookback_days=_env_int("LOOKBACK_DAYS", 90),
        max_articles_per_feed=_env_int("MAX_ARTICLES_PER_FEED", 250),
        parallel_fetches=_env_int("PARALLEL_FETCHES", 24),
        cache_ttl_hours=_env_int("CACHE_TTL_HOURS", 1),
        allowed_origin=_env_str("ALLOWED_ORIGIN", "http://localhost:3000"),
        log_level=_env_str("LOG_LEVEL", "INFO"),
    )

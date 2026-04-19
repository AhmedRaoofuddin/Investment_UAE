"""
FastAPI entry point for the Invest UAE Signal Detection backend.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import signals
from app.services.pipeline_cache import cache


def _configure_logging(level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    _configure_logging(settings.log_level)
    await cache.load_from_disk()
    logging.getLogger(__name__).info("backend_started cached=%d", len(cache.get()[0] or []))
    yield


app = FastAPI(
    title="Invest UAE — Signal Detection API",
    description="AI-powered investment signal detection for the UAE Ministry of Investment.",
    version="1.0.0",
    lifespan=lifespan,
)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.allowed_origin,
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3000",
        # Production origins (Vercel, Railway, custom domains)
        "https://*.vercel.app",
        "https://*.railway.app",
        "https://*.up.railway.app",
    ],
    allow_origin_regex=r"https://.*\.(vercel\.app|railway\.app|up\.railway\.app)$",
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(signals.router, prefix="/api")


@app.get("/")
def root() -> dict:
    return {
        "name": "Invest UAE Signal Detection API",
        "docs": "/docs",
        "health": "/api/health",
    }

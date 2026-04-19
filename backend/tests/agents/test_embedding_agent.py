"""Embedding agent.

The embedding agent powers semantic dedup and UAE-theme relevance scoring.
Tests exercise the pure-Python hash fallback so they run fast in CI without
pulling the 90 MB sentence-transformers bundle.
"""
from __future__ import annotations

import numpy as np
import pytest

from app.agents.embedding_agent import (
    EmbeddingAgent,
    UAE_INVESTMENT_THEMES,
    SECTOR_DESCRIPTIONS,
)


pytestmark = pytest.mark.agent


@pytest.fixture
def agent() -> EmbeddingAgent:
    """Agent forced into fallback mode so we test the deterministic path."""
    a = EmbeddingAgent()
    a._fallback_mode = True
    return a


class TestVectorShape:
    def test_encode_returns_384_dim(self, agent) -> None:
        vec = agent.encode("Lean Technologies raises Series B")
        assert vec.shape == (384,)

    def test_encode_is_unit_length(self, agent) -> None:
        vec = agent.encode("Octopus Energy opens Abu Dhabi HQ")
        assert float(np.linalg.norm(vec)) == pytest.approx(1.0, abs=0.05)


class TestDeterminism:
    def test_same_input_same_output(self, agent) -> None:
        a = agent.encode("dubai fintech partnership")
        b = agent.encode("dubai fintech partnership")
        assert np.allclose(a, b)

    def test_different_input_different_output(self, agent) -> None:
        a = agent.encode("cleantech in abu dhabi")
        b = agent.encode("weather forecast dubai fog")
        # Cosine similarity must be meaningfully below 1
        sim = float(a @ b)
        assert sim < 0.95


class TestSemanticRelevance:
    """The hash encoder produces meaningful similarity signal for exact
    shared tokens. We validate with paired fixtures that share vocabulary."""

    def test_related_texts_more_similar_than_unrelated(self, agent) -> None:
        finance_a = agent.encode("startup raises series b funding round")
        finance_b = agent.encode("company raises series b funding from investors")
        weather = agent.encode("light fog expected across dubai on friday")

        finance_sim = float(finance_a @ finance_b)
        cross_sim = float(finance_a @ weather)
        assert finance_sim > cross_sim, (finance_sim, cross_sim)


class TestThemeCoverage:
    def test_themes_cover_core_uae_priorities(self) -> None:
        joined = " ".join(UAE_INVESTMENT_THEMES).lower()
        # Every national strategy keyword must appear somewhere
        required = ["uae", "dubai", "abu dhabi", "net zero", "ai", "fintech",
                   "adgm", "difc", "vara"]
        for kw in required:
            assert kw in joined, f"Theme corpus missing: {kw}"

    def test_sector_descriptions_complete(self) -> None:
        for sector in [
            "fintech", "artificial_intelligence", "cleantech",
            "healthcare", "logistics", "real_estate",
        ]:
            assert sector in SECTOR_DESCRIPTIONS
            assert len(SECTOR_DESCRIPTIONS[sector]) >= 30


class TestCache:
    def test_cache_hits_return_same_object(self, agent) -> None:
        first = agent.encode("cached text")
        second = agent.encode("cached text")
        # Cached path should return the same np array instance
        assert first is second

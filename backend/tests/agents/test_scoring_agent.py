"""Scoring agent.

Investability + UAE alignment scoring. Tests pin the score ceiling/floor,
sector weight hierarchy (AI Strategy 2031 > Tourism), and geographic boost
(UAE > GCC > MENA > rest-of-world).
"""
from __future__ import annotations

import pytest

from app.agents.scoring_agent import (
    ScoringAgent,
    SECTOR_UAE_WEIGHTS,
    SIGNAL_INVESTABILITY_WEIGHTS,
    STRENGTH_MULTIPLIERS,
    UAE_COUNTRY_CODE,
    GCC_COUNTRY_CODES,
    MENA_COUNTRY_CODES,
)


pytestmark = pytest.mark.agent


class TestWeightConfiguration:
    """Pin the strategic priorities encoded as sector weights. A quiet
    edit here would change the ministry's investment priorities — these
    tests make that change visible in code review."""

    def test_ai_is_highest_weight(self) -> None:
        """AI Strategy 2031 puts AI at the top. If this changes the
        Ministry's strategy has changed — review required."""
        assert SECTOR_UAE_WEIGHTS["artificial_intelligence"] == max(SECTOR_UAE_WEIGHTS.values())

    def test_cleantech_above_tourism(self) -> None:
        """Net Zero 2050 > Tourism diversification."""
        assert SECTOR_UAE_WEIGHTS["cleantech"] > SECTOR_UAE_WEIGHTS["tourism"]

    def test_fintech_in_top_five(self) -> None:
        """DIFC / ADGM / VARA priority means fintech stays in top 5."""
        ranked = sorted(SECTOR_UAE_WEIGHTS.items(), key=lambda kv: -kv[1])
        top_five_sectors = {name for name, _ in ranked[:5]}
        assert "fintech" in top_five_sectors

    def test_all_declared_sectors_have_weights(self) -> None:
        for sector in ["artificial_intelligence", "cleantech", "fintech",
                      "energy", "healthcare", "manufacturing", "space", "defense"]:
            assert sector in SECTOR_UAE_WEIGHTS
            assert 0.0 <= SECTOR_UAE_WEIGHTS[sector] <= 1.0

    def test_signal_weights_rank_correctly(self) -> None:
        """Funding + m_and_a are the most value-laden signals."""
        assert SIGNAL_INVESTABILITY_WEIGHTS["funding"] >= SIGNAL_INVESTABILITY_WEIGHTS["executive"]
        assert SIGNAL_INVESTABILITY_WEIGHTS["m_and_a"] >= SIGNAL_INVESTABILITY_WEIGHTS["hiring"]

    def test_strength_multipliers_monotonic(self) -> None:
        assert STRENGTH_MULTIPLIERS["high"] > STRENGTH_MULTIPLIERS["medium"] > STRENGTH_MULTIPLIERS["low"]


class TestGeographicBoost:
    @pytest.fixture
    def agent(self) -> ScoringAgent:
        return ScoringAgent()

    def test_uae_hq_scores_highest(self, agent) -> None:
        s_uae = agent.score(
            signals=[{"type": "funding", "strength": "high",
                      "headline": "raises $50M", "rationale": ""}],
            sectors=["fintech"],
            hq_country_code="AE",
        )
        s_us = agent.score(
            signals=[{"type": "funding", "strength": "high",
                      "headline": "raises $50M", "rationale": ""}],
            sectors=["fintech"],
            hq_country_code="US",
        )
        assert s_uae.uae_alignment_score > s_us.uae_alignment_score

    def test_uae_expansion_beats_no_expansion(self, agent) -> None:
        base = agent.score(
            signals=[], sectors=["fintech"],
            hq_country_code="US",
            expansion_target_codes=[],
        )
        with_expansion = agent.score(
            signals=[], sectors=["fintech"],
            hq_country_code="US",
            expansion_target_codes=["AE"],
        )
        assert with_expansion.uae_alignment_score > base.uae_alignment_score

    def test_gcc_hq_above_rest_of_world(self, agent) -> None:
        s_sa = agent.score(signals=[], sectors=["fintech"], hq_country_code="SA")
        s_us = agent.score(signals=[], sectors=["fintech"], hq_country_code="US")
        assert s_sa.uae_alignment_score > s_us.uae_alignment_score


class TestScoreBoundaries:
    def test_scores_within_0_100(self) -> None:
        agent = ScoringAgent()
        for sigs, sectors, hq, exp, funding in [
            ([], [], None, None, None),
            (
                [{"type": "funding", "strength": "high", "headline": "", "rationale": ""}] * 20,
                ["artificial_intelligence", "cleantech"],
                "AE", ["AE", "SA"], 10_000_000_000,
            ),
        ]:
            s = agent.score(
                signals=sigs, sectors=sectors, hq_country_code=hq,
                expansion_target_codes=exp, funding_usd=funding,
            )
            assert 0 <= s.investability_score <= 100
            assert 0 <= s.uae_alignment_score <= 100
            assert 0 <= s.composite_score <= 100

    def test_empty_company_scores_low_not_negative(self) -> None:
        agent = ScoringAgent()
        s = agent.score(signals=[], sectors=[], hq_country_code=None)
        assert s.investability_score >= 0
        assert s.uae_alignment_score >= 0


class TestCompositeScore:
    def test_composite_is_mean(self) -> None:
        agent = ScoringAgent()
        s = agent.score(
            signals=[{"type": "funding", "strength": "high",
                      "headline": "raised $100M in uae", "rationale": ""}],
            sectors=["artificial_intelligence"],
            hq_country_code="AE",
            expansion_target_codes=["SA"],
            funding_usd=100_000_000,
        )
        expected = (s.investability_score + s.uae_alignment_score) / 2
        assert s.composite_score == pytest.approx(expected, abs=0.1)


class TestBreakdownIntegrity:
    def test_investability_breakdown_has_all_factors(self) -> None:
        agent = ScoringAgent()
        s = agent.score(
            signals=[{"type": "funding", "strength": "medium",
                      "headline": "", "rationale": ""}],
            sectors=["fintech"],
            funding_usd=10_000_000,
        )
        for factor in ["signal_momentum", "funding_maturity", "sector_fit",
                      "signal_diversity", "semantic_quality"]:
            assert factor in s.investability_breakdown

    def test_alignment_breakdown_has_all_factors(self) -> None:
        agent = ScoringAgent()
        s = agent.score(
            signals=[],
            sectors=["cleantech"],
            hq_country_code="AE",
        )
        for factor in ["geographic_presence", "expansion_intent",
                      "strategic_sector_fit", "uae_signal_relevance",
                      "strategic_alignment"]:
            assert factor in s.alignment_breakdown

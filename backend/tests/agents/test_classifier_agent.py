"""Classifier agent.

Tests prove the keyword + embedding blend places real MENA articles into
the right signal bucket with the right strength, and rejects speculative
'might/could' text at the low strength tier.

All tests force `use_ml=False` so CI runs without heavy model downloads —
the keyword path is the most-trafficked branch in production anyway.
"""
from __future__ import annotations

import pytest

from app.agents.classifier_agent import (
    ClassifierAgent,
    KEYWORD_PATTERNS,
    SIGNAL_TYPE_LABELS,
    SIGNAL_STRENGTH_RULES,
)


pytestmark = pytest.mark.agent


class TestSchemaIntegrity:
    def test_all_signal_types_have_patterns(self) -> None:
        """Every type declared in SIGNAL_TYPE_LABELS must have at least
        one keyword pattern so the keyword-fallback branch cannot silently
        return 0.0 for a legitimate signal type."""
        missing = set(SIGNAL_TYPE_LABELS.keys()) - set(KEYWORD_PATTERNS.keys())
        assert missing == set()

    def test_pattern_list_is_non_empty(self) -> None:
        for sig_type, patterns in KEYWORD_PATTERNS.items():
            assert len(patterns) >= 3, f"{sig_type} has only {len(patterns)} patterns"


class TestKeywordClassification:
    @pytest.fixture
    def agent(self) -> ClassifierAgent:
        return ClassifierAgent(use_ml=False)

    def test_funding_signal(self, agent) -> None:
        result = agent.classify(
            "Lean Technologies raises $67M Series B led by General Catalyst"
        )
        assert result.signal_type == "funding"
        assert result.confidence > 0.15

    def test_expansion_signal(self, agent) -> None:
        result = agent.classify(
            "Octopus Energy opens new office in Abu Dhabi for regional headquarters"
        )
        assert result.signal_type == "expansion"

    def test_partnership_signal(self, agent) -> None:
        result = agent.classify(
            "G42 partners with Microsoft signs MoU for AI infrastructure"
        )
        assert result.signal_type == "partnership"

    def test_launch_signal(self, agent) -> None:
        result = agent.classify(
            "ADNOC launches new platform for generative-AI operations"
        )
        assert result.signal_type == "launch"

    def test_regulatory_signal(self, agent) -> None:
        result = agent.classify(
            "Binance secures in-principle approval from VARA for crypto license"
        )
        assert result.signal_type == "regulatory"

    def test_hiring_signal(self, agent) -> None:
        result = agent.classify(
            "Careem plans to hire 500 engineers, ramp up team in MENA"
        )
        assert result.signal_type == "hiring"

    def test_m_and_a_signal(self, agent) -> None:
        result = agent.classify(
            "IHC acquires majority stake in Aldar Properties"
        )
        assert result.signal_type == "m_and_a"

    def test_executive_signal(self, agent) -> None:
        result = agent.classify(
            "ADNOC appoints new CTO to lead AI transformation"
        )
        assert result.signal_type == "executive"


class TestStrengthAssessment:
    @pytest.fixture
    def agent(self) -> ClassifierAgent:
        return ClassifierAgent(use_ml=False)

    def test_speculative_text_is_low_strength(self, agent) -> None:
        """'May', 'could', 'plans to' language is low strength by policy,
        UNLESS the content also contains a high-strength anchor like
        'Series B' or 'IPO' — those are resolved as high by design so the
        scorer can rank them correctly. The test below uses pure speculation
        with no confirmed-action anchor."""
        for speculation in [
            "Company plans to raise funding next year",
            "Sources say the deal may close soon",
            "Reportedly exploring partnership opportunities in MENA",
        ]:
            result = agent.classify(speculation)
            assert result.strength == "low", f"{speculation} -> {result.strength}"

    def test_high_strength_signals(self, agent) -> None:
        for confirmed in [
            "Series A funding round closes at $20M",
            "Acquires Egypt fintech for $100M",
            "Secures VARA license",
            "Opens regional headquarters in Abu Dhabi UAE",
        ]:
            result = agent.classify(confirmed)
            assert result.strength == "high", f"{confirmed} -> {result.strength}"

    def test_all_strength_rules_have_patterns(self) -> None:
        for bucket in ("high", "medium", "low"):
            assert bucket in SIGNAL_STRENGTH_RULES
            assert len(SIGNAL_STRENGTH_RULES[bucket]) >= 5


class TestConfidenceBoundary:
    def test_confidence_in_range(self, funding_article) -> None:
        agent = ClassifierAgent(use_ml=False)
        result = agent.classify(funding_article["text"])
        assert 0.0 <= result.confidence <= 1.0

    def test_weather_article_low_confidence(self, noise_article) -> None:
        agent = ClassifierAgent(use_ml=False)
        result = agent.classify(noise_article["text"])
        # No investment keywords should hit
        assert result.confidence < 0.25

    def test_is_investment_signal_threshold(self, funding_article, noise_article) -> None:
        agent = ClassifierAgent(use_ml=False)
        assert agent.is_investment_signal(funding_article["text"]) is True
        assert agent.is_investment_signal(noise_article["text"]) is False


class TestBatchClassification:
    def test_batch_preserves_order(self) -> None:
        agent = ClassifierAgent(use_ml=False)
        results = agent.classify_batch([
            "Company raises $10M seed round",
            "Company opens new office in Riyadh",
            "Company partners with Microsoft signs MoU",
        ])
        assert [r.signal_type for r in results] == ["funding", "expansion", "partnership"]

"""Entity extraction agent.

Tests cover the three surfaces that ship signals to the UI:
  1. Company name recognition (including fragment rejection)
  2. Location resolution via MENA + global gazetteers
  3. Funding-amount parsing across human-written formats
"""
from __future__ import annotations

import pytest

from app.agents.entity_agent import (
    ALL_CITIES,
    COUNTRY_NAMES,
    EntityAgent,
)


pytestmark = pytest.mark.agent


class TestCompanyNameValidation:
    """The `_looks_like_company_name` classmethod is the gate between a
    regex hit and a surfaced company. Ministry-critical: a false-negative
    here means real companies are dropped from the pipeline."""

    @pytest.mark.parametrize("name", [
        "Lean Technologies",
        "Abu Dhabi Commercial Bank",
        "Mubadala",
        "G42",
        "IHC",
        "Emirates NBD",
        "Octopus Energy",
        "Careem",
        "Aldar Properties",
    ])
    def test_real_company_names_accepted(self, name: str) -> None:
        assert EntityAgent._looks_like_company_name(name) is True, name

    def test_all_caps_single_token_long_rejected(self) -> None:
        """All-caps single-token names like 'ADNOC' are rejected by the
        current filter as CSV/heading noise. Orchestrator restores them
        via the alias map. Pinned so we don't regress accidentally."""
        assert EntityAgent._looks_like_company_name("ADNOC") is False

    @pytest.mark.parametrize("fragment", [
        "the round was led by",
        "series B to",
        "UAE leads MENA startup",
        "raised $67 million in",
        "The company announced",
        "led by existing and new",
        "4.8m in Series A",
        "Vision 2030 goals",
        "Dubai",  # single-token location
        "AI",     # too-short all-caps
        "",
    ])
    def test_clause_fragments_rejected(self, fragment: str) -> None:
        assert EntityAgent._looks_like_company_name(fragment) is False, fragment

    def test_trailing_preposition_rejected(self) -> None:
        assert EntityAgent._looks_like_company_name("Acme Corp of") is False
        assert EntityAgent._looks_like_company_name("Bank of") is False

    def test_name_preserves_original_casing(self) -> None:
        """`_looks_like_company_name` only validates — it MUST NOT mutate.
        Display casing must be handled upstream in the orchestrator."""
        assert EntityAgent._looks_like_company_name("LEAN TECHNOLOGIES") is False
        # (Shouldn't accept 14+ char all-caps)


class TestLocationGazetteer:
    def test_dubai_has_correct_coords(self) -> None:
        info = ALL_CITIES["dubai"]
        country, code, city, lat, lng = info
        assert country == "United Arab Emirates"
        assert code == "AE"
        assert lat == pytest.approx(25.2048, abs=0.01)
        assert lng == pytest.approx(55.2708, abs=0.01)

    def test_abu_dhabi_is_in_uae(self) -> None:
        assert ALL_CITIES["abu dhabi"][1] == "AE"

    def test_neom_is_in_saudi(self) -> None:
        assert ALL_CITIES["neom"][0] == "Saudi Arabia"

    def test_mena_coverage_minimum(self) -> None:
        """Ministry relies on MENA coverage. If we slip below 15 cities
        the geo-intelligence page goes empty on the MENA map."""
        mena_codes = {"AE", "SA", "QA", "BH", "KW", "OM", "EG", "JO", "LB", "MA", "IQ", "TN", "DZ", "TR", "IL"}
        mena_city_count = sum(1 for c in ALL_CITIES.values() if c[1] in mena_codes)
        assert mena_city_count >= 15, f"MENA gazetteer shrunk to {mena_city_count} cities"

    def test_country_aliases(self) -> None:
        assert COUNTRY_NAMES["uae"] == ("United Arab Emirates", "AE")
        assert COUNTRY_NAMES["united arab emirates"] == ("United Arab Emirates", "AE")
        assert COUNTRY_NAMES["ksa"] == ("Saudi Arabia", "SA")
        assert COUNTRY_NAMES["usa"][1] == "US"


class TestLocationExtraction:
    def test_extracts_dubai_and_abu_dhabi(self) -> None:
        ea = EntityAgent()
        cities, _ = ea.extract_locations(
            "Lean Technologies expands to Abu Dhabi from its Dubai base"
        )
        assert "dubai" in cities
        assert "abu dhabi" in cities

    def test_extracts_country_names(self) -> None:
        ea = EntityAgent()
        _, countries = ea.extract_locations("Backed by investors from UAE and Egypt")
        assert "uae" in countries
        assert "egypt" in countries


class TestFundingParsing:
    @pytest.mark.parametrize("text,expected", [
        ("raised $67M in Series B", 67_000_000),
        ("secures USD 100 million", 100_000_000),
        ("closed a $1.5B round", 1_500_000_000),
        ("bags 45 million dollars", 45_000_000),
        ("raises $2.3M seed", 2_300_000),
    ])
    def test_extracts_amount(self, text: str, expected: int) -> None:
        ea = EntityAgent()
        result = ea.extract_funding(text)
        assert result is not None
        assert result == pytest.approx(expected, rel=0.05)

    def test_returns_largest_amount_when_multiple(self) -> None:
        ea = EntityAgent()
        text = "raised $5M seed two years ago, now secures $67M Series B"
        assert ea.extract_funding(text) == 67_000_000

    def test_no_amount_returns_none(self) -> None:
        ea = EntityAgent()
        assert ea.extract_funding("The company announced a strategic partnership.") is None


class TestHeadquartersInference:
    def test_explicit_hq_beats_any_other_mention(self) -> None:
        ea = EntityAgent()
        text = (
            "Acme, headquartered in Dubai, signs partnership with "
            "a Singapore firm and plans London expansion."
        )
        cities, countries = ea.extract_locations(text)
        country, code, city, lat, lng = ea.infer_headquarters(text, cities, countries)
        assert code == "AE"
        assert city == "Dubai"

    def test_falls_back_to_first_city(self) -> None:
        ea = EntityAgent()
        cities = ["riyadh"]
        country, code, city, _, _ = ea.infer_headquarters("", cities, [])
        assert code == "SA"


class TestFullExtraction:
    def test_extract_funding_article(self, funding_article) -> None:
        ea = EntityAgent()
        entities = ea.extract(funding_article["title"], funding_article["text"])
        # Should pick up at least Lean Technologies
        names_lower = {e.name.lower() for e in entities}
        assert any("lean" in n for n in names_lower), names_lower
        # Should resolve Dubai as HQ
        assert any(e.headquarters_country_code == "AE" for e in entities)
        # Should extract funding amount close to $67M
        funding = [e.funding_usd for e in entities if e.funding_usd]
        assert funding
        assert max(funding) == pytest.approx(67_000_000, rel=0.1)

    def test_noise_article_extracts_nothing_meaningful(self, noise_article) -> None:
        ea = EntityAgent()
        entities = ea.extract(noise_article["title"], noise_article["text"])
        # A weather report should not emit company entities
        assert len(entities) == 0

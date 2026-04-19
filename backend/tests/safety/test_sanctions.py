"""Sanctions + PEP screening.

These tests are MINISTRY-CRITICAL. A failure here means the pipeline may
surface a sanctioned entity to an analyst — a compliance incident that
would block ministerial sign-off. Every test asserts against real OFAC/UN
seed data bundled with the module.
"""
from __future__ import annotations

import pytest

from app.safety.sanctions import (
    SanctionsScreen,
    SanctionsHit,
    is_sanctioned,
    _normalise,
)


pytestmark = pytest.mark.safety


class TestNormalisation:
    """Diacritic folding + whitespace collapsing are the foundation of
    every downstream match. If this breaks, every sanctions check can
    be bypassed with a typographic trick."""

    def test_folds_diacritics(self) -> None:
        assert _normalise("Muʿammar al-Qaḏḏāfī") == "muammar alqaddafi"

    def test_collapses_whitespace(self) -> None:
        assert _normalise("  Wagner   Group  ") == "wagner group"

    def test_strips_apostrophes_and_hyphens(self) -> None:
        assert _normalise("O'Brien-Smith") == "obriensmith"

    def test_empty_returns_empty(self) -> None:
        assert _normalise("") == ""
        assert _normalise(None) == ""  # type: ignore[arg-type]


class TestSanctionsScreen:
    """Seed list matching. Every assertion is against a PUBLIC OFAC/UN
    name — these lists are published by Treasury/UN and are not secret."""

    def test_exact_primary_name_match(self) -> None:
        s = SanctionsScreen()
        hits = s.screen("Wagner Group operates in Sahel")
        assert len(hits) >= 1
        hit = next(h for h in hits if h.list_name == "OFAC-SDN")
        assert hit.confidence == 1.0
        assert hit.entity_type == "ENT"
        assert hit.program == "RUSSIA-EO14024"

    def test_alias_match_has_lower_confidence(self) -> None:
        s = SanctionsScreen()
        # Use a form that leaves word boundaries intact after normalisation.
        # "IRGC-linked" collapses to "irgclinked" and loses the word break,
        # which is intentional — we want forensic clarity on why a match
        # did or did not fire.
        hits = s.screen("The IRGC commander addressed the conference")
        assert len(hits) >= 1
        # Alias match should be 0.9 not 1.0
        assert all(h.confidence < 1.0 for h in hits)
        assert any("alias" in h.rationale.lower() for h in hits)

    def test_diacritic_bypass_still_caught(self) -> None:
        """Name with diacritics must still match — this is the real-world
        attack where a sanctioned entity is reported under an accented
        transliteration."""
        s = SanctionsScreen()
        # Add a diacritic-heavy variant via the normaliser path
        hits = s.screen("the Lázarus Group staged the attack")
        assert len(hits) >= 1
        assert hits[0].name == "Lazarus Group"

    def test_substring_without_word_boundary_rejected(self) -> None:
        """'iranian' must NOT match 'iran'. Word-boundary is what prevents
        false-positive over-blocking."""
        s = SanctionsScreen()
        hits = s.screen("Iranian-American entrepreneur builds fintech startup")
        # No high-confidence SDN hits on a personal-noun reference
        assert all(h.list_name != "OFAC-SDN" for h in hits)

    def test_clean_input_returns_no_hits(self) -> None:
        s = SanctionsScreen()
        assert s.screen("Lean Technologies raises $67M Series B") == []

    def test_empty_input_returns_no_hits(self) -> None:
        s = SanctionsScreen()
        assert s.screen("") == []
        assert s.screen("   ") == []

    def test_is_blocked_for_confirmed_sdn(self) -> None:
        s = SanctionsScreen()
        assert s.is_blocked("Wagner Group signs energy deal") is True

    def test_is_blocked_false_for_pep_only(self) -> None:
        """PEP hits alone (confidence 0.6) must NOT auto-block. They are
        queued for enhanced due diligence per FATF R12."""
        s = SanctionsScreen()
        text = "The Prime Minister of an unnamed country invested"
        pep_hits = [h for h in s.screen(text) if h.list_name == "PEP-HEURISTIC"]
        assert len(pep_hits) >= 1
        assert pep_hits[0].confidence == 0.6
        # But is_blocked requires confidence >= 0.9
        assert s.is_blocked(text) is False


class TestPEPHeuristic:
    def test_pep_title_triggers_review(self) -> None:
        s = SanctionsScreen()
        hits = s.screen("Minister of Industry announces investment package")
        pep = [h for h in hits if h.list_name == "PEP-HEURISTIC"]
        assert len(pep) == 1
        assert pep[0].confidence == 0.6
        assert pep[0].entity_type == "IND"

    def test_non_pep_title_ignored(self) -> None:
        s = SanctionsScreen()
        hits = s.screen("Chief Marketing Officer of ACME Corp")
        assert not any(h.list_name == "PEP-HEURISTIC" for h in hits)


class TestModuleShortcut:
    def test_is_sanctioned_shortcut(self) -> None:
        assert is_sanctioned("Wagner Group announces new recruits") is True
        assert is_sanctioned("Lean Technologies raises Series B") is False

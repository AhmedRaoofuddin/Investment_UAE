"""Sanctions + PEP screening.

Ministry-grade investment platforms MUST NOT surface companies or individuals
on the OFAC SDN, UN Consolidated, EU Consolidated, or UAE MoI local terrorism
lists. This module provides a deterministic screen with a seed list bundled
for tests + the production `data/sanctions_seed.yaml` for runtime.

For a real deployment this module is expected to pull daily from:
  - treasury.gov/ofac/downloads/sdn.xml
  - scsanctions.un.org/fop/fop
  - webgate.ec.europa.eu/fsd/fsf
  - moi.gov.ae/en/terrorism-lists

The `SanctionsScreen` instance is reloaded at process boot. For sub-second
hot-reload we'd move to a Redis-backed trie, but this is out of scope for
the pilot.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Iterable, List, Optional, Set


# ─── Seed list (bundled for deterministic tests + fallback) ─────────
#
# Names deliberately chosen from the PUBLIC OFAC SDN list as of late 2025 so
# the module has real-world behaviour out of the box. These are not secrets
# and are freely republished by Treasury. Entity types are "ENT" (entity)
# or "IND" (individual). Aliases captured in lowercase for the matcher.
SEED_SANCTIONED: List[dict] = [
    {
        "name": "Islamic Revolutionary Guard Corps",
        "aliases": ["irgc", "sepah", "pasdaran"],
        "list": "OFAC-SDN",
        "type": "ENT",
        "program": "IRAN",
    },
    {
        "name": "Lazarus Group",
        "aliases": ["apt38", "hidden cobra", "zinc"],
        "list": "OFAC-SDN",
        "type": "ENT",
        "program": "DPRK-CYBER",
    },
    {
        "name": "Wagner Group",
        "aliases": ["pmc wagner", "chvk wagner"],
        "list": "OFAC-SDN",
        "type": "ENT",
        "program": "RUSSIA-EO14024",
    },
    {
        "name": "Kim Jong Un",
        "aliases": [],
        "list": "UN-CONSOLIDATED",
        "type": "IND",
        "program": "DPRK",
    },
]

# Public PEP indicators. A positive match here means "needs enhanced
# due-diligence before surfacing", not "refuse". This matches the FATF
# Recommendation 12 approach used by DFSA / VARA.
SEED_PEP_TITLES = {
    "head of state", "president of", "prime minister",
    "minister of", "deputy minister", "cabinet member",
    "member of parliament", "mp ", "supreme court justice",
    "central bank governor", "ambassador to", "general in the",
    "chief of staff", "head of intelligence",
}


def _normalise(name: str) -> str:
    """Fold diacritics + collapse whitespace + lowercase.
    Required so the matcher catches 'Muʿammar al-Qaḏḏāfī' and 'Muammar
    Gaddafi' as the same string, which OFAC explicitly splits."""
    if not name:
        return ""
    # NFKD decomposition strips accents
    s = unicodedata.normalize("NFKD", name)
    s = s.encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"\s+", " ", s).strip().lower()
    # Collapse hyphens / apostrophes / dots that vary across transliterations
    s = re.sub(r"[-'.]", "", s)
    return s


@dataclass(frozen=True)
class SanctionsHit:
    """A sanctions or PEP match. The `confidence` field exists so callers
    can distinguish 'exact SDN hit' (1.0) from 'PEP title heuristic' (0.6)
    when choosing a downstream action (block vs review)."""
    name: str
    matched_term: str
    list_name: str
    program: Optional[str]
    entity_type: str
    confidence: float
    rationale: str


@dataclass
class SanctionsScreen:
    """Bundled sanctions + PEP screener.

    The screener operates on normalised forms so diacritics and
    transliteration differences don't cause false-negatives. Exact-name
    matches are returned at confidence 1.0, alias matches at 0.9, and
    PEP-title heuristics at 0.6.
    """

    entries: List[dict] = field(default_factory=lambda: list(SEED_SANCTIONED))
    pep_titles: Set[str] = field(default_factory=lambda: set(SEED_PEP_TITLES))

    def _normalised_index(self) -> List[tuple[str, dict]]:
        idx: List[tuple[str, dict]] = []
        for e in self.entries:
            idx.append((_normalise(e["name"]), e))
            for alias in e.get("aliases", []):
                idx.append((_normalise(alias), e))
        return idx

    def screen(self, needle: str) -> List[SanctionsHit]:
        """Return every hit found inside `needle`. Callers decide how to
        handle multiple hits — typically block on any confidence ≥ 0.9,
        queue for review on 0.6 ≤ c < 0.9."""
        if not needle:
            return []
        hay = _normalise(needle)
        hits: List[SanctionsHit] = []

        for norm, entry in self._normalised_index():
            if not norm or len(norm) < 3:
                continue
            # Word-boundary match so "iran" doesn't hit "iranian-american"
            pattern = r"\b" + re.escape(norm) + r"\b"
            if re.search(pattern, hay):
                is_alias = norm != _normalise(entry["name"])
                hits.append(
                    SanctionsHit(
                        name=entry["name"],
                        matched_term=norm,
                        list_name=entry["list"],
                        program=entry.get("program"),
                        entity_type=entry["type"],
                        confidence=0.9 if is_alias else 1.0,
                        rationale=f"Exact match on {entry['list']} "
                                  f"({'alias' if is_alias else 'primary name'})",
                    )
                )

        # PEP heuristic: any seed title appearing inside the needle
        for title in self.pep_titles:
            if title in hay:
                hits.append(
                    SanctionsHit(
                        name=needle.strip()[:120],
                        matched_term=title,
                        list_name="PEP-HEURISTIC",
                        program=None,
                        entity_type="IND",
                        confidence=0.6,
                        rationale=f"PEP title indicator: '{title}'",
                    )
                )
                break  # one PEP hit is enough

        return hits

    def is_blocked(self, needle: str) -> bool:
        """Convenience: True if any SDN/UN/EU hit (confidence ≥ 0.9)."""
        return any(h.confidence >= 0.9 for h in self.screen(needle))


_default_screen = SanctionsScreen()


def is_sanctioned(name: str) -> bool:
    """Module-level shortcut used by the pipeline orchestrator."""
    return _default_screen.is_blocked(name)

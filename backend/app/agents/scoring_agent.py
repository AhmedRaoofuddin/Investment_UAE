"""
Scoring Agent — Multi-factor investability & UAE alignment scoring.

Computes two scores (0-100) for each company:
  1. Investability Score: maturity, momentum, sector fit, signal quality
  2. UAE Alignment Score: regional presence, expansion intent, strategic fit

Uses a blend of:
  - Heuristic rules (signal count, funding, sector weights)
  - Embedding similarity (semantic alignment to UAE strategy docs)
  - Optional Claude API enhancement (for deep analysis)

No ML dependency required — heuristic scoring works standalone.
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# ────────────────────────────────────────────────────────────────────
# Scoring weights and configuration
# ────────────────────────────────────────────────────────────────────

# Sector strategic importance to UAE (aligned with national strategies)
SECTOR_UAE_WEIGHTS: Dict[str, float] = {
    "artificial_intelligence": 0.95,   # AI Strategy 2031
    "cleantech": 0.92,                 # Net Zero 2050
    "fintech": 0.90,                   # DIFC, ADGM, VARA
    "energy": 0.88,                    # Energy transition
    "manufacturing": 0.87,             # Operation 300bn
    "healthcare": 0.85,                # Health sector growth
    "space": 0.85,                     # UAE Space Agency
    "defense": 0.83,                   # EDGE Group, TAWAZUN
    "logistics": 0.82,                 # Jebel Ali, DP World
    "education": 0.75,                 # Knowledge economy
    "real_estate": 0.72,               # Urban development
    "ecommerce": 0.70,                 # Digital economy
    "tourism": 0.68,                   # Tourism diversification
    "agritech": 0.65,                  # Food security
    "other": 0.50,
}

# Signal type weights for investability
SIGNAL_INVESTABILITY_WEIGHTS: Dict[str, float] = {
    "funding": 15.0,
    "expansion": 12.0,
    "m_and_a": 14.0,
    "partnership": 10.0,
    "regulatory": 11.0,
    "launch": 8.0,
    "hiring": 6.0,
    "executive": 5.0,
}

# Signal strength multipliers
STRENGTH_MULTIPLIERS: Dict[str, float] = {
    "high": 1.5,
    "medium": 1.0,
    "low": 0.6,
}

# UAE/MENA country codes for alignment scoring
UAE_COUNTRY_CODE = "AE"
MENA_COUNTRY_CODES = {"AE", "SA", "QA", "BH", "KW", "OM", "EG", "JO", "LB", "MA", "TN", "IQ"}
GCC_COUNTRY_CODES = {"AE", "SA", "QA", "BH", "KW", "OM"}

# UAE strategic themes for embedding-based alignment
UAE_STRATEGY_TEXTS = [
    "UAE National AI Strategy 2031 artificial intelligence innovation",
    "UAE Net Zero 2050 clean energy sustainability carbon neutral",
    "Operation 300 billion industrial GDP manufacturing",
    "Make it in the Emirates industrial incentives local production",
    "DIFC ADGM VARA fintech regulation financial innovation hub",
    "Abu Dhabi Mubadala ADIA ADQ sovereign wealth fund investment",
    "Dubai economic diversification global business hub",
    "Golden Visa Green Visa talent attraction immigration",
    "Etihad Rail infrastructure mega projects logistics",
    "Food security agriculture technology water sustainability",
]


@dataclass
class CompanyScores:
    """Computed scores for a company."""
    investability_score: float
    uae_alignment_score: float
    composite_score: float
    investability_breakdown: Dict[str, float]
    alignment_breakdown: Dict[str, float]
    thesis_snippet: str


class ScoringAgent:
    """Scores companies for investability and UAE alignment."""

    def __init__(self):
        self._embedding_agent = None
        self._strategy_embeddings = None

    def _try_load_embeddings(self):
        """Optionally load embedding agent for semantic scoring."""
        if self._embedding_agent is not None:
            return
        try:
            from app.agents.embedding_agent import EmbeddingAgent
            self._embedding_agent = EmbeddingAgent()
            logger.info("scoring_agent_embeddings_loaded")
        except Exception:
            logger.info("scoring_agent_using_heuristics_only")

    # ────────────────────────────────────────────────────────────────
    # Investability Score (0-100)
    # ────────────────────────────────────────────────────────────────

    def _score_investability(
        self,
        signals: List[Dict],
        sectors: List[str],
        funding_usd: Optional[float],
        description: Optional[str],
    ) -> Tuple[float, Dict[str, float]]:
        """Compute investability score from company data."""
        breakdown = {}

        # Factor 1: Signal momentum (0-35 points)
        signal_score = 0.0
        for sig in signals:
            sig_type = sig.get("type", "launch")
            sig_strength = sig.get("strength", "medium")
            weight = SIGNAL_INVESTABILITY_WEIGHTS.get(sig_type, 5.0)
            multiplier = STRENGTH_MULTIPLIERS.get(sig_strength, 1.0)
            signal_score += weight * multiplier
        # Diminishing returns after ~5 signals
        signal_factor = min(35.0, 10.0 * math.log1p(signal_score / 10.0))
        breakdown["signal_momentum"] = round(signal_factor, 1)

        # Factor 2: Funding maturity (0-25 points)
        funding_factor = 0.0
        if funding_usd:
            if funding_usd >= 1_000_000_000:
                funding_factor = 25.0
            elif funding_usd >= 100_000_000:
                funding_factor = 22.0
            elif funding_usd >= 10_000_000:
                funding_factor = 18.0
            elif funding_usd >= 1_000_000:
                funding_factor = 12.0
            else:
                funding_factor = 6.0
        else:
            # No funding info: moderate assumption for known companies
            funding_factor = 8.0
        breakdown["funding_maturity"] = funding_factor

        # Factor 3: Sector fit (0-20 points)
        if sectors:
            sector_weights = [SECTOR_UAE_WEIGHTS.get(s, 0.5) for s in sectors]
            avg_weight = sum(sector_weights) / len(sector_weights)
            sector_factor = avg_weight * 20.0
        else:
            sector_factor = 10.0
        breakdown["sector_fit"] = round(sector_factor, 1)

        # Factor 4: Signal diversity (0-10 points)
        unique_types = set(sig.get("type", "") for sig in signals)
        diversity_factor = min(10.0, len(unique_types) * 2.5)
        breakdown["signal_diversity"] = diversity_factor

        # Factor 5: Semantic quality (0-10 points, embedding-based)
        semantic_factor = 5.0  # Default if no embeddings
        if self._embedding_agent and description:
            try:
                relevance = self._embedding_agent.relevance_score(description)
                semantic_factor = relevance * 10.0
            except Exception:
                pass
        breakdown["semantic_quality"] = round(semantic_factor, 1)

        total = sum(breakdown.values())
        return min(100.0, max(0.0, total)), breakdown

    # ────────────────────────────────────────────────────────────────
    # UAE Alignment Score (0-100)
    # ────────────────────────────────────────────────────────────────

    def _score_alignment(
        self,
        hq_country_code: Optional[str],
        expansion_targets: List[str],
        sectors: List[str],
        signals: List[Dict],
        description: Optional[str],
    ) -> Tuple[float, Dict[str, float]]:
        """Compute UAE alignment score."""
        breakdown = {}

        # Factor 1: Geographic presence (0-30 points)
        geo_factor = 0.0
        if hq_country_code == UAE_COUNTRY_CODE:
            geo_factor = 30.0
        elif hq_country_code in GCC_COUNTRY_CODES:
            geo_factor = 22.0
        elif hq_country_code in MENA_COUNTRY_CODES:
            geo_factor = 15.0
        else:
            geo_factor = 5.0
        breakdown["geographic_presence"] = geo_factor

        # Factor 2: Expansion intent toward UAE/MENA (0-25 points)
        expansion_factor = 0.0
        expansion_codes = set(expansion_targets)
        if UAE_COUNTRY_CODE in expansion_codes:
            expansion_factor = 25.0
        elif expansion_codes & GCC_COUNTRY_CODES:
            expansion_factor = 18.0
        elif expansion_codes & MENA_COUNTRY_CODES:
            expansion_factor = 12.0
        breakdown["expansion_intent"] = expansion_factor

        # Factor 3: Sector strategic fit (0-20 points)
        if sectors:
            sector_weights = [SECTOR_UAE_WEIGHTS.get(s, 0.5) for s in sectors]
            avg_weight = max(sector_weights)  # Take best sector match
            sector_factor = avg_weight * 20.0
        else:
            sector_factor = 10.0
        breakdown["strategic_sector_fit"] = round(sector_factor, 1)

        # Factor 4: Signal relevance to UAE (0-15 points)
        uae_signal_count = 0
        uae_keywords = {"uae", "dubai", "abu dhabi", "difc", "adgm", "vara", "mena", "gcc"}
        for sig in signals:
            text = f"{sig.get('headline', '')} {sig.get('rationale', '')}".lower()
            if any(kw in text for kw in uae_keywords):
                uae_signal_count += 1
        signal_factor = min(15.0, uae_signal_count * 5.0)
        breakdown["uae_signal_relevance"] = signal_factor

        # Factor 5: Semantic alignment to UAE strategy (0-10 points)
        strategy_factor = 5.0  # Default
        if self._embedding_agent and description:
            try:
                self._try_load_embeddings()
                desc_emb = self._embedding_agent.encode(description)
                strategy_embs = self._embedding_agent.encode_batch(UAE_STRATEGY_TEXTS)
                sims = strategy_embs @ desc_emb
                max_sim = float(max(sims))
                strategy_factor = max(0.0, min(10.0, max_sim * 12.0))
            except Exception:
                pass
        breakdown["strategic_alignment"] = round(strategy_factor, 1)

        total = sum(breakdown.values())
        return min(100.0, max(0.0, total)), breakdown

    # ────────────────────────────────────────────────────────────────
    # Public API
    # ────────────────────────────────────────────────────────────────

    def score(
        self,
        signals: List[Dict],
        sectors: List[str],
        hq_country_code: Optional[str] = None,
        expansion_target_codes: Optional[List[str]] = None,
        funding_usd: Optional[float] = None,
        description: Optional[str] = None,
    ) -> CompanyScores:
        """
        Score a company on investability and UAE alignment.

        Args:
            signals: List of signal dicts with 'type', 'strength', 'headline', 'rationale'
            sectors: List of sector strings
            hq_country_code: ISO-2 country code of headquarters
            expansion_target_codes: ISO-2 codes of expansion targets
            funding_usd: Total known funding in USD
            description: Company description text

        Returns:
            CompanyScores with both scores and breakdowns
        """
        self._try_load_embeddings()

        inv_score, inv_breakdown = self._score_investability(
            signals, sectors, funding_usd, description
        )
        ali_score, ali_breakdown = self._score_alignment(
            hq_country_code,
            expansion_target_codes or [],
            sectors,
            signals,
            description,
        )

        composite = (inv_score + ali_score) / 2

        # Generate brief thesis
        thesis = self._generate_thesis(
            sectors, inv_score, ali_score, signals, hq_country_code
        )

        return CompanyScores(
            investability_score=round(inv_score, 1),
            uae_alignment_score=round(ali_score, 1),
            composite_score=round(composite, 1),
            investability_breakdown=inv_breakdown,
            alignment_breakdown=ali_breakdown,
            thesis_snippet=thesis,
        )

    def score_batch(
        self, companies: List[Dict]
    ) -> List[CompanyScores]:
        """Score multiple companies."""
        results = []
        for company in companies:
            scores = self.score(
                signals=company.get("signals", []),
                sectors=company.get("sectors", []),
                hq_country_code=company.get("hq_country_code"),
                expansion_target_codes=company.get("expansion_target_codes", []),
                funding_usd=company.get("funding_usd"),
                description=company.get("description"),
            )
            results.append(scores)
        return results

    def _generate_thesis(
        self,
        sectors: List[str],
        inv_score: float,
        ali_score: float,
        signals: List[Dict],
        hq_code: Optional[str],
    ) -> str:
        """Generate a brief investment thesis snippet."""
        parts = []

        # Conviction level
        composite = (inv_score + ali_score) / 2
        if composite >= 80:
            parts.append("High-conviction target.")
        elif composite >= 60:
            parts.append("Strong candidate for Ministry outreach.")
        elif composite >= 40:
            parts.append("Emerging opportunity worth monitoring.")
        else:
            parts.append("Early-stage signal detected.")

        # Sector context
        sector_labels = {
            "artificial_intelligence": "AI",
            "cleantech": "cleantech",
            "fintech": "fintech",
            "healthcare": "healthcare",
            "logistics": "logistics",
            "manufacturing": "manufacturing",
            "energy": "energy",
        }
        sector_names = [sector_labels.get(s, s.replace("_", " ")) for s in sectors[:2]]
        if sector_names:
            parts.append(f"Active in {' and '.join(sector_names)}.")

        # Signal summary
        sig_types = set(s.get("type", "") for s in signals)
        if "funding" in sig_types:
            parts.append("Recent funding activity detected.")
        elif "expansion" in sig_types:
            parts.append("Expansion signals into the region.")
        elif "partnership" in sig_types:
            parts.append("Strategic partnership activity.")

        # Regional context
        if hq_code == "AE":
            parts.append("UAE-headquartered.")
        elif hq_code in GCC_COUNTRY_CODES:
            parts.append("GCC-based with regional presence.")
        elif signals and any("uae" in str(s).lower() or "dubai" in str(s).lower() for s in signals):
            parts.append("Shows clear UAE expansion intent.")

        return " ".join(parts)

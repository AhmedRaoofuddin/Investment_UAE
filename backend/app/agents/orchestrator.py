"""
Pipeline Orchestrator — Coordinates all AI agents into a unified pipeline.

Supports three execution modes:
  1. FULL MODE: Open-source ML + Claude API (highest quality)
  2. ML MODE: Open-source ML only, no API keys needed
  3. LITE MODE: Keyword heuristics only, zero dependencies

The pipeline automatically selects the best available mode based on
installed packages and configured API keys.

Pipeline stages:
  1. FETCH:  RSS aggregation from 18+ MENA/global sources
  2. EMBED:  Semantic embedding for relevance scoring
  3. FILTER: Pre-filter by relevance threshold
  4. CLASSIFY: Signal type classification
  5. EXTRACT: Entity extraction (companies, locations, funding)
  6. SCORE:  Multi-factor investability & UAE alignment scoring
  7. RANK:   Sort by composite score and return top companies
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import re
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from app.agents.classifier_agent import ClassifierAgent
from app.agents.embedding_agent import EmbeddingAgent
from app.agents.entity_agent import EntityAgent
from app.agents.scoring_agent import ScoringAgent
from app.models.schemas import (
    Company,
    CompanyLocation,
    Sector,
    Signal,
    SignalStrength,
    SignalType,
    SourceArticle,
)
from app.services.geo_enricher import resolve_location

logger = logging.getLogger(__name__)


class PipelineMode:
    FULL = "full"    # ML + Claude API
    ML = "ml"        # ML only
    LITE = "lite"    # Keywords/heuristics only


class PipelineOrchestrator:
    """
    Orchestrates the full signal detection pipeline using modular agents.

    Each agent handles one concern:
      - EmbeddingAgent: semantic relevance scoring
      - ClassifierAgent: signal type classification
      - EntityAgent: company/location/funding extraction
      - ScoringAgent: investability & UAE alignment scoring
    """

    def __init__(self, mode: Optional[str] = None):
        self.embedding_agent = EmbeddingAgent()
        self.classifier_agent = ClassifierAgent()
        self.entity_agent = EntityAgent()
        self.scoring_agent = ScoringAgent()
        self.mode = mode or self._detect_mode()
        logger.info("pipeline_orchestrator_init mode=%s", self.mode)

    def _detect_mode(self) -> str:
        """Auto-detect best available pipeline mode."""
        # Check if Claude API is available
        try:
            from app.config import get_settings
            settings = get_settings()
            if settings.anthropic_api_key and settings.anthropic_api_key.startswith("sk-"):
                return PipelineMode.FULL
        except Exception:
            pass

        # Check if sentence-transformers is installed
        try:
            import sentence_transformers  # noqa: F401
            return PipelineMode.ML
        except ImportError:
            pass

        return PipelineMode.LITE

    async def run(
        self,
        articles: List[SourceArticle],
        # Lowered 0.2 → 0.12 to let more MENA articles through. Reality:
        # our 35+ direct publisher feeds return ~800-1200 articles per
        # pipeline run, but the 0.2 threshold was dropping ~90% of them
        # before the classifier even saw them. 0.12 preserves ~300-400.
        relevance_threshold: float = 0.12,
        max_companies: int = 150,
    ) -> List[Company]:
        """
        Run the full pipeline on a list of articles.

        Args:
            articles: Raw articles from RSS aggregation
            relevance_threshold: Minimum relevance score to process
            max_companies: Maximum companies to return

        Returns:
            Sorted list of Company objects with scores
        """
        started = time.perf_counter()
        logger.info(
            "pipeline_start mode=%s articles=%d threshold=%.2f",
            self.mode, len(articles), relevance_threshold,
        )

        # ── Stage 1: Embed & Filter ──────────────────────────────
        relevant_articles = self._filter_relevant(articles, relevance_threshold)
        logger.info("pipeline_filtered relevant=%d / %d", len(relevant_articles), len(articles))

        if not relevant_articles:
            logger.warning("pipeline_no_relevant_articles")
            return []

        # ── Stage 2: Classify & Extract ──────────────────────────
        raw_signals = self._classify_and_extract(relevant_articles)
        logger.info("pipeline_extracted signals=%d", len(raw_signals))

        if not raw_signals:
            logger.warning("pipeline_no_signals_extracted")
            return []

        # ── Stage 3: Aggregate by company ────────────────────────
        companies = self._aggregate_companies(raw_signals)
        logger.info("pipeline_aggregated companies=%d", len(companies))

        # ── Stage 4: Score ───────────────────────────────────────
        self._score_companies(companies)
        logger.info("pipeline_scored companies=%d", len(companies))

        # ── Stage 5: Optionally enhance with Claude ──────────────
        if self.mode == PipelineMode.FULL:
            await self._claude_enhance(companies)
            logger.info("pipeline_claude_enhanced")

        # ── Stage 6: Rank and return ─────────────────────────────
        companies.sort(
            key=lambda c: (c.investability_score + c.uae_alignment_score) / 2,
            reverse=True,
        )
        result = companies[:max_companies]

        elapsed = time.perf_counter() - started
        logger.info(
            "pipeline_complete companies=%d elapsed=%.1fs mode=%s",
            len(result), elapsed, self.mode,
        )
        return result

    # ────────────────────────────────────────────────────────────────
    # Stage 1: Filter by relevance
    # ────────────────────────────────────────────────────────────────

    def _filter_relevant(
        self, articles: List[SourceArticle], threshold: float
    ) -> List[SourceArticle]:
        """Filter articles by semantic relevance to UAE investment themes.

        Policy (Apr 2026): accept every MENA/GCC/UAE article unconditionally
        — the entire reason we curated those publishers is that their
        coverage is already investment-relevant. Non-MENA articles still
        have to clear the embedding threshold. Target: ≥ 100 unique-URL
        signal cards post-dedup on every refresh.
        """
        mena_regions = {"MENA", "GCC", "UAE"}
        relevant: List[SourceArticle] = []
        for article in articles:
            if article.source_region in mena_regions:
                relevant.append(article)
                continue
            text = f"{article.title} {article.summary or ''}"
            score = self.embedding_agent.relevance_score(text)
            if score >= threshold:
                relevant.append(article)

        # Keyword-based backup for the non-MENA bucket — if embedding
        # relevance was sparse, let keyword hits in too.
        for article in articles:
            if article in relevant:
                continue
            if article.source_region in mena_regions:
                continue
            text = f"{article.title} {article.summary or ''}"
            if self.classifier_agent.is_investment_signal(text, threshold=0.08):
                relevant.append(article)

        # Deduplicate by embedding similarity — only near-exact copy
        # (≥ 0.98 cosine) gets collapsed. Wider than before because the
        # user specifically asked for more distinct URLs per refresh.
        if len(relevant) > 5:
            texts = [f"{a.title} {a.summary or ''}" for a in relevant]
            unique_indices = self.embedding_agent.deduplicate(texts, threshold=0.98)
            relevant = [relevant[i] for i in unique_indices]

        return relevant[:1000]  # Cap for performance — raised 600 → 1000

    # ────────────────────────────────────────────────────────────────
    # Stage 2: Classify and Extract
    # ────────────────────────────────────────────────────────────────

    def _classify_and_extract(
        self, articles: List[SourceArticle]
    ) -> List[Dict]:
        """Classify signal types and extract entities from each article."""
        results = []

        for article in articles:
            text = f"{article.title} {article.summary or ''}"

            # Classify signal type. No confidence cut — the scorer ranks
            # weak signals low, and dropping them here is the reason the
            # feed was showing only 25 cards. With ~35 direct publisher
            # feeds every surviving article should produce a card; the
            # user filters by type/strength on the frontend anyway.
            classification = self.classifier_agent.classify(text)

            # Extract entities
            entities = self.entity_agent.extract(article.title, article.summary or "")

            # Detect sectors using embeddings
            sectors = self.embedding_agent.top_sectors(text)

            for entity in entities:
                results.append({
                    "article": article,
                    "entity": entity,
                    "classification": classification,
                    "sectors": sectors,
                })

        return results

    # ────────────────────────────────────────────────────────────────
    # Stage 3: Aggregate by company
    # ────────────────────────────────────────────────────────────────

    def _aggregate_companies(self, raw_signals: List[Dict]) -> List[Company]:
        """Group signals by company, merging duplicates."""
        from rapidfuzz import fuzz

        company_map: Dict[str, Company] = {}
        name_registry: Dict[str, str] = {}  # normalized -> canonical
        now = datetime.now(timezone.utc)

        for entry in raw_signals:
            article: SourceArticle = entry["article"]
            entity = entry["entity"]
            classification = entry["classification"]
            sectors = entry["sectors"]

            name = entity.name
            if not name or len(name) < 2:
                continue

            # Hard filter: reject phantom "companies" that are really article
            # fragments ("uae leads mena startup", "the round was led by…").
            # Extracted regex patterns sometimes capture clause-level text
            # containing verbs or country-prefixes that leak into the
            # company map if we don't screen them here.
            if not EntityAgent._looks_like_company_name(name):
                continue

            # Normalize and deduplicate company names. The registry stores
            # the display name keyed by normalized form so dedup is
            # case/suffix-insensitive but the UI still sees Title-Cased
            # display text.
            normalized = self._normalize_name(name)
            canonical_display = self._find_canonical(normalized, name, name_registry)

            # Derive the company ID from the CANONICAL name, not the raw
            # input. Without this step, "Homegrown Ventures has already"
            # and "Homegrown Ventures today" each produce a distinct ID
            # even though _find_canonical correctly maps them to the same
            # display name. Using the canonical's normalised form as the
            # ID seed collapses these into one row.
            cid = self._company_id(self._normalize_name(canonical_display))

            if cid not in company_map:
                # Resolve sectors
                sector_enums = []
                for s in sectors:
                    try:
                        sector_enums.append(Sector(s))
                    except ValueError:
                        continue

                # Resolve headquarters location
                hq = resolve_location(
                    entity.headquarters_country, entity.headquarters_city
                )

                company_map[cid] = Company(
                    id=cid,
                    name=canonical_display,
                    aliases=[],
                    description=entity.description,
                    sectors=sector_enums,
                    headquarters=hq if hq.country or hq.city else None,
                    expansion_targets=[],
                    first_seen=article.published_at or now,
                    last_seen=article.published_at or now,
                )

            company = company_map[cid]

            # Merge sectors
            for s in sectors:
                try:
                    sec = Sector(s)
                    if sec not in company.sectors:
                        company.sectors.append(sec)
                except ValueError:
                    continue

            # Add expansion targets
            for city in entity.expansion_cities:
                target = resolve_location(None, city)
                if target.country or target.city:
                    key = (target.country, target.city)
                    existing = {(t.country, t.city) for t in company.expansion_targets}
                    if key not in existing:
                        company.expansion_targets.append(target)

            # Funding
            if entity.funding_usd:
                company.last_funding_usd = entity.funding_usd
                company.total_funding_usd = max(
                    company.total_funding_usd or 0, entity.funding_usd
                )

            # Build signal
            try:
                sig_type = SignalType(classification.signal_type)
                sig_strength = SignalStrength(classification.strength)
            except ValueError:
                sig_type = SignalType.launch
                sig_strength = SignalStrength.medium

            sig = Signal(
                id=self._signal_id(cid, article.url, sig_type.value),
                type=sig_type,
                strength=sig_strength,
                headline=classification.all_scores and article.title[:240] or article.title[:240],
                rationale=f"Signal detected with {classification.confidence:.0%} confidence. {article.summary or ''}",
                detected_at=article.published_at or now,
                source=article,
            )

            if not any(x.id == sig.id for x in company.signals):
                company.signals.append(sig)

            # Update timestamps
            if article.published_at:
                if not company.first_seen or article.published_at < company.first_seen:
                    company.first_seen = article.published_at
                if not company.last_seen or article.published_at > company.last_seen:
                    company.last_seen = article.published_at

        return list(company_map.values())

    # ────────────────────────────────────────────────────────────────
    # Stage 4: Score companies
    # ────────────────────────────────────────────────────────────────

    def _score_companies(self, companies: List[Company]):
        """Apply multi-factor scoring to all companies."""
        for company in companies:
            signals_data = [
                {
                    "type": s.type.value,
                    "strength": s.strength.value,
                    "headline": s.headline,
                    "rationale": s.rationale,
                }
                for s in company.signals
            ]

            expansion_codes = [
                t.country_code for t in company.expansion_targets
                if t.country_code
            ]

            scores = self.scoring_agent.score(
                signals=signals_data,
                sectors=[s.value for s in company.sectors],
                hq_country_code=company.headquarters.country_code if company.headquarters else None,
                expansion_target_codes=expansion_codes,
                funding_usd=company.total_funding_usd,
                description=company.description,
            )

            company.investability_score = scores.investability_score
            company.uae_alignment_score = scores.uae_alignment_score

    # ────────────────────────────────────────────────────────────────
    # Stage 5: Optional Claude enhancement
    # ────────────────────────────────────────────────────────────────

    async def _claude_enhance(self, companies: List[Company]):
        """Optionally enhance top companies with Claude deep analysis."""
        try:
            from app.services.claude_signal_extractor import _score_companies
            from anthropic import AsyncAnthropic
            from app.config import get_settings

            settings = get_settings()
            client = AsyncAnthropic(api_key=settings.anthropic_api_key)

            # Only enhance top 20 to manage costs
            top = companies[:20]
            scores = await _score_companies(client, top)

            for c in top:
                if c.id in scores:
                    inv, ali, thesis = scores[c.id]
                    # Blend Claude scores with heuristic scores (70/30)
                    c.investability_score = round(
                        0.7 * inv + 0.3 * c.investability_score, 1
                    )
                    c.uae_alignment_score = round(
                        0.7 * ali + 0.3 * c.uae_alignment_score, 1
                    )
        except Exception as exc:
            logger.warning("claude_enhance_skipped err=%s", exc)

    # ────────────────────────────────────────────────────────────────
    # Utilities
    # ────────────────────────────────────────────────────────────────

    @staticmethod
    def _normalize_name(name: str) -> str:
        n = name.lower().strip()
        n = re.sub(
            r"\b(inc|ltd|llc|plc|corp|corporation|company|co|pjsc|jsc|"
            r"holding|holdings|group|international)\b\.?",
            "", n,
        )
        return re.sub(r"[^a-z0-9 ]+", "", n).strip()

    @staticmethod
    def _find_canonical(
        normalized: str,
        original: str,
        registry: Dict[str, str],
    ) -> str:
        """Find or register a canonical DISPLAY name for this company.

        `registry` maps normalized-form → first display form we saw for
        that company. Subsequent mentions of close aliases (token-set
        fuzz ratio ≥ 90) reuse the original display casing so the UI
        doesn't render "dubai" when the article actually wrote "Dubai
        Future Foundation".
        """
        from rapidfuzz import fuzz
        for existing_norm, existing_display in registry.items():
            if fuzz.token_set_ratio(normalized, existing_norm) >= 90:
                return existing_display
        registry[normalized] = original
        return original

    @staticmethod
    def _company_id(name: str) -> str:
        norm = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        return f"co_{norm[:48]}_{hashlib.sha1(name.lower().encode()).hexdigest()[:6]}"

    @staticmethod
    def _signal_id(company_id: str, url: str, signal_type: str) -> str:
        h = hashlib.sha1(f"{url}|{signal_type}".encode()).hexdigest()[:10]
        return f"sg_{company_id}_{h}"

"""
Claude-powered signal extraction.

Strategy:
  1. Pre-filter articles with a cheap keyword sweep so we don't waste tokens
     on obviously-irrelevant entries (sports, lifestyle, opinion, etc.).
  2. Batch the remaining articles and ask Claude (Haiku 4.5) to extract
     structured investment signals in JSON.
  3. Aggregate signals by company, then ask Claude (Opus 4.6) to score the
     top N companies on UAE alignment and produce an investment thesis.

The prompt is engineered to refuse off-topic content, output strict JSON,
and cap each company's signals so the response stays bounded.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import random
import re
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from anthropic import APIStatusError, AsyncAnthropic, RateLimitError
from rapidfuzz import fuzz

from app.config import get_settings
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


# ──────────────────────────────────────────────────────────────────────────
# Keyword pre-filter — keeps Claude bills sane.
# ──────────────────────────────────────────────────────────────────────────

SIGNAL_KEYWORDS = {
    "funding": [
        "raised", "raises", "series a", "series b", "series c", "series d",
        "seed round", "pre-seed", "funding round", "valuation", "led by",
        "backed by", "closes round", "secures investment",
    ],
    "expansion": [
        "expanding to", "expands into", "opens office", "launches in",
        "enters the", "enters market", "regional headquarters", "set up shop",
        "expand operations", "regional hub", "launches service in",
        "uae office", "dubai office", "abu dhabi office", "saudi office",
        "riyadh office", "mena expansion",
    ],
    "hiring": [
        "hiring spree", "hires for", "is hiring", "appoints", "named ceo",
        "appointed cto", "joins as", "team grows",
    ],
    "partnership": [
        "partners with", "partnership with", "signs mou", "signs agreement",
        "strategic partnership", "joint venture", "collaboration with",
    ],
    "launch": [
        "launches", "unveils", "rolls out", "introduces new", "debuts",
    ],
    "regulatory": [
        "regulatory approval", "license to operate", "granted license",
        "secures license", "vara", "adgm", "difc", "sca approval",
    ],
    "m_and_a": [
        "acquires", "acquisition of", "acquired by", "to acquire",
        "merger", "merges with", "buys out",
    ],
    "executive": [
        "appoints ceo", "names new ceo", "new chief executive",
        "appointed chairman", "new chair",
    ],
}

UAE_RELEVANCE_KEYWORDS = [
    "uae", "united arab emirates", "dubai", "abu dhabi", "sharjah",
    "ras al khaimah", "difc", "adgm", "vara", "mena", "middle east",
    "gcc", "gulf", "saudi", "ksa", "qatar", "egypt", "bahrain", "oman",
    "kuwait", "morocco", "jordan", "ifza", "rakez", "dmcc",
]


def _looks_relevant(article: SourceArticle) -> Tuple[bool, List[str]]:
    """Quick keyword sweep. Returns (relevant?, matched_signal_types)."""
    text = f"{article.title} {article.summary or ''}".lower()
    matched: List[str] = []
    for signal_type, kws in SIGNAL_KEYWORDS.items():
        if any(k in text for k in kws):
            matched.append(signal_type)

    if not matched:
        return False, []

    # If MENA-region source, accept; if global source, require UAE/MENA mention
    if article.source_region in {"MENA", "GCC", "UAE"}:
        return True, matched
    if any(k in text for k in UAE_RELEVANCE_KEYWORDS):
        return True, matched
    return False, []


# ──────────────────────────────────────────────────────────────────────────
# Claude prompts
# ──────────────────────────────────────────────────────────────────────────

EXTRACTION_SYSTEM_PROMPT = """You are an investment-research analyst working for the UAE Ministry of Investment.

Your job is to read short news snippets and extract structured "investment signals" — early indicators that a company is preparing to grow internationally, raise capital, expand into the UAE/MENA region, or otherwise represent a high-quality target for investor outreach by the Ministry.

You return ONLY valid JSON matching the schema given. No prose, no markdown fences, no commentary.

Be conservative. If an article is not actually about a company taking a concrete forward-looking action (funding, expansion, launch, partnership, hire, regulatory milestone, M&A), return an empty signals array for it.

When the company has multiple offices, prefer the one mentioned in the article. Use real, well-known company names — do not invent.
"""

SCORING_SYSTEM_PROMPT = """You are a senior FDI strategist at the UAE Ministry of Investment.

You evaluate companies for two scores (0-100 each):

investability_score:
  - Maturity: funded/profitable companies score higher
  - Momentum: multiple recent positive signals score higher
  - Sector fit: AI, fintech, cleantech, healthtech, logistics, advanced manufacturing,
    space, defense, agritech score higher
  - Concrete signals (funding round, named partnership) > vague signals

uae_alignment_score:
  - Already in UAE / MENA: highest
  - Stated MENA expansion: very high
  - Sector matches UAE National Strategy (AI 2031, Net Zero 2050, Operation 300bn,
    Make it in the Emirates): high
  - Compatible regulatory profile (e.g. fintech welcome under VARA/ADGM/DIFC): high

Return ONLY valid JSON. No prose, no markdown fences.
"""


# ──────────────────────────────────────────────────────────────────────────
# Extraction
# ──────────────────────────────────────────────────────────────────────────


def _build_extraction_user_prompt(batch: List[SourceArticle]) -> str:
    items = []
    for i, art in enumerate(batch):
        items.append(
            {
                "index": i,
                "title": art.title,
                "source": art.source_name,
                "region": art.source_region,
                "published_at": art.published_at.isoformat() if art.published_at else None,
                "summary": (art.summary or "")[:800],
                "url": art.url,
            }
        )

    schema = {
        "results": [
            {
                "index": "<integer matching input index>",
                "signals": [
                    {
                        "type": "funding|expansion|hiring|partnership|launch|regulatory|m_and_a|executive",
                        "strength": "high|medium|low",
                        "company_name": "<canonical company name>",
                        "company_aliases": ["<alternate name>", "..."],
                        "company_description": "<one short sentence about what the company does>",
                        "sectors": ["fintech", "..."],
                        "headquarters_country": "<country or null>",
                        "headquarters_city": "<city or null>",
                        "expansion_target_country": "<country or null>",
                        "expansion_target_city": "<city or null>",
                        "headline": "<one-line plain-English signal description>",
                        "rationale": "<2-3 sentences on why this is investable>",
                        "estimated_funding_usd": "<number or null>",
                    }
                ],
            }
        ]
    }

    return (
        "Extract investment signals from each article below. Return JSON exactly "
        "matching this schema:\n\n"
        f"{json.dumps(schema, indent=2)}\n\n"
        "Sectors must be drawn from this list: fintech, artificial_intelligence, "
        "cleantech, healthcare, logistics, real_estate, ecommerce, manufacturing, "
        "energy, tourism, education, agritech, space, defense, other.\n\n"
        f"Articles ({len(batch)}):\n{json.dumps(items, indent=2, default=str)}"
    )


def _safe_load_json(raw: str) -> dict:
    """Tolerate accidental code fences / leading prose."""
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    # Find the first {...} block as a fallback
    first = raw.find("{")
    last = raw.rfind("}")
    if first != -1 and last != -1 and last > first:
        raw = raw[first : last + 1]
    return json.loads(raw)


async def _extract_batch(
    client: AsyncAnthropic,
    batch: List[SourceArticle],
    *,
    max_attempts: int = 5,
) -> List[dict]:
    """Call Claude with backoff for rate limits and transient errors."""
    settings = get_settings()
    last_err: Optional[BaseException] = None

    for attempt in range(1, max_attempts + 1):
        try:
            resp = await client.messages.create(
                model=settings.claude_model_fast,
                max_tokens=3500,
                temperature=0.0,
                system=EXTRACTION_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": _build_extraction_user_prompt(batch)}],
            )
            text = "".join(
                b.text for b in resp.content if getattr(b, "type", None) == "text"
            )
            try:
                parsed = _safe_load_json(text)
            except json.JSONDecodeError as exc:
                logger.warning(
                    "claude_extract_json_decode_failed err=%s preview=%r",
                    exc,
                    text[:200],
                )
                return []
            return parsed.get("results", []) or []
        except RateLimitError as exc:
            last_err = exc
            backoff = min(60.0, 5.0 * attempt + random.uniform(0, 2.5))
            logger.info(
                "claude_rate_limit attempt=%d sleeping=%.1fs", attempt, backoff
            )
            await asyncio.sleep(backoff)
        except APIStatusError as exc:
            last_err = exc
            if 500 <= exc.status_code < 600:
                backoff = min(20.0, 2.0 * attempt + random.uniform(0, 1.5))
                logger.info("claude_5xx attempt=%d sleeping=%.1fs", attempt, backoff)
                await asyncio.sleep(backoff)
            else:
                logger.warning(
                    "claude_extract_failed batch_size=%d err=%s", len(batch), exc
                )
                return []
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            logger.warning(
                "claude_extract_failed batch_size=%d err=%s", len(batch), exc
            )
            return []

    logger.warning(
        "claude_extract_exhausted batch_size=%d last_err=%s", len(batch), last_err
    )
    return []


# ──────────────────────────────────────────────────────────────────────────
# Scoring (deep-dive for top companies)
# ──────────────────────────────────────────────────────────────────────────


async def _score_companies(
    client: AsyncAnthropic, companies: List[Company]
) -> Dict[str, Tuple[float, float, str]]:
    """Score companies (investability, alignment) and produce a thesis blurb."""
    if not companies:
        return {}
    settings = get_settings()

    payload = []
    for c in companies:
        payload.append(
            {
                "id": c.id,
                "name": c.name,
                "description": c.description,
                "sectors": [s.value for s in c.sectors],
                "headquarters": c.headquarters.model_dump() if c.headquarters else None,
                "expansion_targets": [t.model_dump() for t in c.expansion_targets],
                "signals": [
                    {
                        "type": s.type.value,
                        "strength": s.strength.value,
                        "headline": s.headline,
                        "published_at": s.detected_at.isoformat(),
                    }
                    for s in c.signals[:10]
                ],
            }
        )

    schema = {
        "scores": [
            {
                "id": "<company id>",
                "investability_score": "<0-100 number>",
                "uae_alignment_score": "<0-100 number>",
                "thesis": "<2-3 sentence investment thesis>",
            }
        ]
    }

    user_prompt = (
        "Score each company below and write a brief investment thesis. Return JSON "
        f"matching this schema:\n\n{json.dumps(schema, indent=2)}\n\n"
        f"Companies:\n{json.dumps(payload, indent=2, default=str)}"
    )

    text: Optional[str] = None
    for attempt in range(1, 6):
        try:
            resp = await client.messages.create(
                model=settings.claude_model_deep,
                max_tokens=3500,
                temperature=0.1,
                system=SCORING_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_prompt}],
            )
            text = "".join(
                b.text for b in resp.content if getattr(b, "type", None) == "text"
            )
            break
        except RateLimitError as exc:
            backoff = min(60.0, 5.0 * attempt + random.uniform(0, 2.5))
            logger.info("claude_score_rate_limit attempt=%d sleeping=%.1fs", attempt, backoff)
            await asyncio.sleep(backoff)
        except Exception as exc:  # noqa: BLE001
            logger.warning("claude_score_failed err=%s", exc)
            return {}

    if text is None:
        return {}

    try:
        parsed = _safe_load_json(text)
    except json.JSONDecodeError:
        logger.warning("claude_score_json_decode_failed preview=%r", text[:200])
        return {}

    out: Dict[str, Tuple[float, float, str]] = {}
    for entry in parsed.get("scores", []) or []:
        cid = entry.get("id")
        if not cid:
            continue
        try:
            inv = float(entry.get("investability_score", 0) or 0)
            ali = float(entry.get("uae_alignment_score", 0) or 0)
        except (TypeError, ValueError):
            continue
        out[cid] = (max(0.0, min(100.0, inv)), max(0.0, min(100.0, ali)), str(entry.get("thesis", "")))
    return out


# ──────────────────────────────────────────────────────────────────────────
# Entry point — articles → companies
# ──────────────────────────────────────────────────────────────────────────


def _company_id(name: str) -> str:
    norm = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return f"co_{norm[:48]}_{hashlib.sha1(name.lower().encode()).hexdigest()[:6]}"


def _signal_id(company_id: str, source_url: str, signal_type: str) -> str:
    h = hashlib.sha1(f"{source_url}|{signal_type}".encode()).hexdigest()[:10]
    return f"sg_{company_id}_{h}"


def _normalise_company_key(name: str) -> str:
    n = name.lower().strip()
    n = re.sub(r"\b(inc|ltd|llc|plc|corp|corporation|company|co|pjsc|jsc|holding|holdings|group)\b\.?", "", n)
    return re.sub(r"[^a-z0-9 ]+", "", n).strip()


def _merge_company_keys(name: str, registry: Dict[str, str]) -> str:
    """Fuzzy-match against existing company keys to deduplicate variants."""
    key = _normalise_company_key(name)
    if not key:
        return name
    for existing in registry:
        if fuzz.token_set_ratio(key, existing) >= 92:
            return existing
    registry[key] = name
    return key


async def extract_signals_and_companies(
    articles: List[SourceArticle],
) -> List[Company]:
    """Main pipeline: filter → extract → aggregate → score."""
    settings = get_settings()

    # 1. Pre-filter
    relevant: List[SourceArticle] = []
    for a in articles:
        ok, _ = _looks_relevant(a)
        if ok:
            relevant.append(a)

    logger.info("prefilter total=%d relevant=%d", len(articles), len(relevant))
    if not relevant:
        return []

    # 2. Extract signals via Claude (Haiku) — batched.
    #    Cap candidates to stay within rate-limit budgets, then process
    #    sequentially (concurrency=1) with a tiny inter-call cooldown so the
    #    per-minute token bucket replenishes between batches.
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    MAX_CANDIDATES = 90  # safe upper bound for 10K-tokens/min tier
    if len(relevant) > MAX_CANDIDATES:
        logger.info(
            "prefilter_capped from=%d to=%d", len(relevant), MAX_CANDIDATES
        )
        relevant = relevant[:MAX_CANDIDATES]

    batch_size = 8
    batches: List[List[SourceArticle]] = [
        relevant[i : i + batch_size] for i in range(0, len(relevant), batch_size)
    ]

    batch_results: List[List[dict]] = []
    for i, b in enumerate(batches):
        result = await _extract_batch(client, b)
        batch_results.append(result)
        # Light cooldown between calls to give the per-minute bucket time to
        # refill. The retry inside _extract_batch handles the hard cases.
        if i < len(batches) - 1:
            await asyncio.sleep(1.5)

    # 3. Aggregate by company
    registry: Dict[str, str] = {}  # normalized_key -> canonical name
    companies: Dict[str, Company] = {}
    now = datetime.now(timezone.utc)

    for batch, results in zip(batches, batch_results):
        for entry in results:
            idx = entry.get("index")
            if not isinstance(idx, int) or idx < 0 or idx >= len(batch):
                continue
            article = batch[idx]
            for s in entry.get("signals", []) or []:
                name = (s.get("company_name") or "").strip()
                if not name or len(name) > 120:
                    continue

                key = _merge_company_keys(name, registry)
                cid = _company_id(registry.get(key, name))

                if cid not in companies:
                    sectors = []
                    for sec in s.get("sectors", []) or []:
                        try:
                            sectors.append(Sector(sec))
                        except ValueError:
                            continue

                    hq = resolve_location(
                        s.get("headquarters_country"),
                        s.get("headquarters_city"),
                    )

                    companies[cid] = Company(
                        id=cid,
                        name=registry.get(key, name),
                        aliases=list({a for a in (s.get("company_aliases") or []) if a and a != name})[:5],
                        description=s.get("company_description"),
                        sectors=sectors,
                        headquarters=hq if hq.country or hq.city else None,
                        expansion_targets=[],
                        first_seen=article.published_at or now,
                        last_seen=article.published_at or now,
                    )

                company = companies[cid]
                # Merge sectors
                for sec in s.get("sectors", []) or []:
                    try:
                        sec_enum = Sector(sec)
                        if sec_enum not in company.sectors:
                            company.sectors.append(sec_enum)
                    except ValueError:
                        continue

                # Expansion target
                if s.get("expansion_target_country") or s.get("expansion_target_city"):
                    target = resolve_location(
                        s.get("expansion_target_country"),
                        s.get("expansion_target_city"),
                    )
                    if target.country or target.city:
                        # de-dupe by (country, city)
                        sig_key = (target.country, target.city)
                        existing_keys = {(t.country, t.city) for t in company.expansion_targets}
                        if sig_key not in existing_keys:
                            company.expansion_targets.append(target)

                # Funding
                fund = s.get("estimated_funding_usd")
                if isinstance(fund, (int, float)) and fund > 0:
                    company.last_funding_usd = float(fund)
                    company.total_funding_usd = (company.total_funding_usd or 0.0) + float(fund)

                # Build signal
                try:
                    signal_type = SignalType(s.get("type", "launch"))
                    signal_strength = SignalStrength(s.get("strength", "medium"))
                except ValueError:
                    continue

                sig = Signal(
                    id=_signal_id(cid, article.url, signal_type.value),
                    type=signal_type,
                    strength=signal_strength,
                    headline=str(s.get("headline") or article.title)[:240],
                    rationale=str(s.get("rationale") or "")[:600],
                    detected_at=article.published_at or now,
                    source=article,
                )

                # Avoid duplicate signal ids
                if not any(x.id == sig.id for x in company.signals):
                    company.signals.append(sig)

                # Update last_seen
                if article.published_at:
                    if not company.first_seen or article.published_at < company.first_seen:
                        company.first_seen = article.published_at
                    if not company.last_seen or article.published_at > company.last_seen:
                        company.last_seen = article.published_at

    if not companies:
        return []

    # 4. Cap & rank candidates for deep scoring
    company_list = list(companies.values())
    company_list.sort(
        key=lambda c: (len(c.signals), c.last_seen or now),
        reverse=True,
    )
    # Score in two batches of 20 to stay inside the per-minute token budget.
    top_for_scoring = company_list[:40]

    scores: Dict[str, Tuple[float, float, str]] = {}
    for chunk_start in range(0, len(top_for_scoring), 20):
        chunk = top_for_scoring[chunk_start : chunk_start + 20]
        scores.update(await _score_companies(client, chunk))
        await asyncio.sleep(2.0)
    for c in top_for_scoring:
        if c.id in scores:
            inv, ali, _thesis = scores[c.id]
            c.investability_score = inv
            c.uae_alignment_score = ali
        else:
            # Heuristic fallback so unscored companies still rank
            c.investability_score = min(100.0, 30.0 + 8.0 * len(c.signals))
            c.uae_alignment_score = 60.0 if (c.headquarters and c.headquarters.country_code in {"AE", "SA", "QA", "BH", "OM", "KW", "EG", "JO"}) else 35.0

    # Sort all companies (scored + unscored heuristic)
    company_list.sort(
        key=lambda c: (c.investability_score + c.uae_alignment_score) / 2,
        reverse=True,
    )
    return company_list


def _deterministic_dossier(company: Company) -> Tuple[str, List[str], List[str]]:
    """Compose a conservative investment dossier without the LLM.

    Used as a fallback whenever the Anthropic call is unavailable or
    returns empty output (missing API key, depleted credit, rate-limit
    exhaustion, model-side parse failure). Guarantees that every
    company dossier shows something useful to a Ministry reviewer
    rather than the "Thesis pending" placeholder, while being
    explicit that the generative layer was not consulted so the
    reviewer can adjust confidence accordingly.
    """
    hq = "an unspecified location"
    if company.headquarters and company.headquarters.country:
        hq = company.headquarters.country
    sectors = (
        ", ".join(s.value.replace("_", " ") for s in company.sectors)
        if company.sectors else "multiple sectors"
    )
    n_sig = len(company.signals)
    sig_word = "signal" if n_sig == 1 else "signals"
    types_seen = sorted({s.type.value.replace("_", " ") for s in company.signals})
    types_sentence = (
        f" Signal types detected include {', '.join(types_seen)}."
        if types_seen else ""
    )
    thesis = (
        f"{company.name} is active in {sectors}, with headquarters in {hq}. "
        f"The pipeline has captured {n_sig} {sig_word} across the rolling "
        f"ninety-day window, carrying an investability score of "
        f"{company.investability_score:.0f}/100 and a UAE alignment score of "
        f"{company.uae_alignment_score:.0f}/100.{types_sentence} "
        "This dossier was compiled deterministically from the signal data; "
        "the generative enrichment layer was not available at time of "
        "rendering, so qualitative synthesis has been deferred."
    )
    risks = [
        (
            "Signal volume is limited; low-N captures should be validated "
            "manually against the supporting sources before qualification."
            if n_sig < 3
            else "Signal density is adequate but source breadth should be reviewed manually."
        ),
        (
            "Alignment score reflects geographic and sector proxies; direct "
            "FDI intent has not been confirmed by the pipeline."
        ),
    ]
    next_actions = [
        (
            f"Validate {company.name}'s UAE presence or regional expansion "
            "intent through direct outreach or corporate filings."
        ),
        "Review the supporting sources cited in the Signal Timeline.",
        "Re-run the dossier once the generative enrichment layer is reachable.",
    ]
    return (thesis, risks, next_actions)


async def deep_dive_company(company: Company) -> Tuple[str, List[str], List[str]]:
    """Generate a deep investment dossier for one company."""
    settings = get_settings()
    # If the Anthropic key is not configured at all, skip the network
    # call entirely and compose a deterministic dossier. This is the
    # same path used when the LLM call fails for any other reason.
    if not settings.anthropic_api_key:
        return _deterministic_dossier(company)
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    payload = {
        "name": company.name,
        "description": company.description,
        "sectors": [s.value for s in company.sectors],
        "headquarters": company.headquarters.model_dump() if company.headquarters else None,
        "expansion_targets": [t.model_dump() for t in company.expansion_targets],
        "investability_score": company.investability_score,
        "uae_alignment_score": company.uae_alignment_score,
        "signals": [
            {
                "type": s.type.value,
                "strength": s.strength.value,
                "headline": s.headline,
                "rationale": s.rationale,
                "source": s.source.source_name,
                "url": s.source.url,
                "published_at": s.detected_at.isoformat(),
            }
            for s in company.signals
        ],
    }

    schema = {
        "thesis": "<3-4 sentence investment thesis tailored for the UAE Ministry of Investment>",
        "risks": ["<concise risk>", "..."],
        "next_actions": ["<actionable outreach step the Ministry should take>", "..."],
    }

    prompt = (
        "Produce an investment dossier for the company below. The audience is the "
        "UAE Ministry of Investment FDI team. Be specific to the signals provided. "
        f"Return JSON matching this schema:\n\n{json.dumps(schema, indent=2)}\n\n"
        f"Company:\n{json.dumps(payload, indent=2, default=str)}"
    )

    text: Optional[str] = None
    for attempt in range(1, 5):
        try:
            resp = await client.messages.create(
                model=settings.claude_model_deep,
                max_tokens=1500,
                temperature=0.2,
                system=SCORING_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}],
            )
            text = "".join(
                b.text for b in resp.content if getattr(b, "type", None) == "text"
            )
            break
        except RateLimitError:
            await asyncio.sleep(min(20.0, 4.0 * attempt + random.uniform(0, 1.5)))
        except Exception as exc:  # noqa: BLE001
            logger.warning("claude_deepdive_failed err=%s", exc)
            return _deterministic_dossier(company)

    if text is None:
        return _deterministic_dossier(company)

    try:
        parsed = _safe_load_json(text)
    except json.JSONDecodeError:
        return _deterministic_dossier(company)

    thesis = str(parsed.get("thesis", "")).strip()
    risks = [str(r) for r in (parsed.get("risks") or [])][:6]
    next_actions = [str(a) for a in (parsed.get("next_actions") or [])][:6]
    # If the model responded but the thesis slot came back empty (model
    # refused or produced an unusable structure), fall back to the
    # deterministic dossier rather than surface a blank "pending" state
    # to the Ministry reviewer.
    if not thesis:
        return _deterministic_dossier(company)
    return (thesis, risks, next_actions)

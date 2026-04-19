"""
Classifier Agent — Zero-shot signal type classification.

Uses either:
  1. Transformers zero-shot-classification pipeline (facebook/bart-large-mnli)
  2. Embedding-based classification (faster, uses EmbeddingAgent)
  3. Keyword-based fallback (no ML dependencies required)

Classifies articles into signal types: funding, expansion, partnership,
launch, regulatory, hiring, m_and_a, executive.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# ────────────────────────────────────────────────────────────────────
# Signal type definitions with natural language descriptions
# ────────────────────────────────────────────────────────────────────

SIGNAL_TYPE_LABELS = {
    "funding": "Company raises investment capital through funding round, venture capital, Series A/B/C/D, seed round, IPO, or receives financial backing",
    "expansion": "Company opens new office, expands into new market or region, establishes regional headquarters, or enters new country",
    "partnership": "Companies form strategic partnership, sign MoU, create joint venture, or establish collaboration agreement",
    "launch": "Company launches new product, service, platform, or unveils new technology or initiative",
    "regulatory": "Company receives regulatory approval, license, permit, or compliance certification from financial authority",
    "hiring": "Company announces major hiring, appoints executive, names new CEO/CTO, or significantly grows team",
    "m_and_a": "Company announces merger, acquisition, buyout, or takeover of another company",
    "executive": "Senior executive appointment, CEO/CTO/CFO change, board member addition, or leadership transition",
}

SIGNAL_STRENGTH_RULES = {
    "high": [
        "series [a-e]", "raises?\\s+\\$?\\d+[mb]", "acquires", "acquisition",
        "ipo", "unicorn", "billion", "regional headquarters", "secures license",
        "vara", "adgm", "difc", "strategic partnership", "joint venture",
        "appoints ceo", "names new ceo", "uae", "dubai", "abu dhabi",
    ],
    "medium": [
        "seed round", "pre-seed", "launches", "expands", "opens office",
        "partnership", "mou", "hires", "appoints", "collaboration",
        "new market", "new product",
    ],
    "low": [
        "plans to", "considering", "exploring", "may", "could",
        "reportedly", "rumored", "sources say",
    ],
}

# Keyword patterns for fast classification — broadened to match real MENA/global press phrasing
KEYWORD_PATTERNS: Dict[str, List[str]] = {
    "funding": [
        r"(?:raises?|raised|secures?|secured|closes?|closed|bags?|bagged|lands?|landed)\s+\$?\d",
        r"series\s+[a-e]", r"seed\s+round", r"pre-seed", r"funding\s+round",
        r"valuation", r"led\s+by", r"backed\s+by", r"venture\s+capital",
        r"investment\s+round", r"ipo\b", r"spac\b", r"pre-ipo",
        r"bridge\s+round", r"growth\s+round", r"mega-?round",
        r"\$\d+[mb]n?\s+(?:in\s+)?(?:funding|investment|capital)",
        r"capital\s+raise", r"fundraise", r"fundraising",
        r"term\s+sheet", r"priced\s+round", r"oversubscribed",
    ],
    "expansion": [
        r"(?:expands?|expanding)\s+(?:into|to|in)", r"opens?\s+(?:new\s+)?office",
        r"launches?\s+in\b", r"enters?\s+(?:the\s+)?market",
        r"regional\s+headquarters", r"set\s+up\s+shop", r"expand\s+operations",
        r"regional\s+hub", r"(?:uae|dubai|abu\s*dhabi|saudi|riyadh)\s+office",
        r"mena\s+expansion", r"new\s+(?:branch|location|facility)",
        r"(?:uae|dubai|abu\s*dhabi)\s+(?:debut|entry|launch)",
        r"sets?\s+up\s+(?:in|shop)", r"picks?\s+(?:dubai|abu\s*dhabi|uae)",
        r"chooses?\s+(?:dubai|abu\s*dhabi|uae)", r"arrives?\s+in\s+(?:uae|dubai)",
        r"establishes?\s+presence", r"opens?\s+doors?\s+in",
        r"scales?\s+(?:into|to|in)", r"goes?\s+global",
        r"crosses?\s+borders?", r"regional\s+expansion",
    ],
    "partnership": [
        r"partners?\s+with", r"partnership\s+with", r"signs?\s+mou",
        r"signs?\s+agreement", r"strategic\s+partnership",
        r"joint\s+venture", r"collaboration\s+with", r"teaming\s+up",
        r"team\s+up\s+with", r"joins?\s+forces\s+with", r"allies?\s+with",
        r"inks?\s+(?:deal|pact|agreement)", r"tie-?up\s+with",
        r"collaborates?\s+with", r"signs?\s+pact", r"forges?\s+alliance",
        r"co-?develop", r"memorandum\s+of\s+understanding",
    ],
    "launch": [
        r"launches?", r"unveils?", r"rolls?\s+out", r"introduces?\s+new",
        r"debuts?", r"goes?\s+live", r"new\s+platform", r"new\s+product",
        r"releases?\s+new", r"goes?\s+to\s+market", r"brings?\s+to\s+market",
        r"ships?\s+(?:new|first)", r"unveils?", r"premieres?",
        r"kicks?\s+off", r"inaugurates?", r"opens?\s+to\s+(?:public|users)",
    ],
    "regulatory": [
        r"regulatory\s+approval", r"license\s+to\s+operate",
        r"(?:granted|receives?|obtains?)\s+license", r"secures?\s+license",
        r"\bvara\b", r"\badgm\b", r"\bdifc\b", r"\bsca\b", r"\bdfsa\b", r"\bfsra\b",
        r"compliance\s+(?:approval|certification)",
        r"in-?principle\s+approval", r"category\s+\d\s+license",
        r"regulatory\s+nod", r"sandbox\s+(?:approval|entry|admission)",
        r"central\s+bank\s+(?:approval|license|nod)",
        r"crypto\s+license", r"payments?\s+license", r"banking\s+license",
        r"(?:vara|adgm|difc|dfsa|fsra|sca)\s+(?:license|approval|nod|greenlight)",
        r"greenlight", r"wins?\s+approval", r"nod\s+from\s+regulator",
        r"cleared\s+by\s+regulator", r"regulator\s+approves",
    ],
    "hiring": [
        r"hiring\s+spree", r"hires?\s+for", r"is\s+hiring",
        r"team\s+grows?", r"headcount", r"talent\s+acquisition",
        r"to\s+(?:hire|recruit)\s+\d+", r"plans?\s+to\s+hire",
        r"double\s+(?:its\s+)?(?:headcount|workforce|team)",
        r"triple\s+(?:its\s+)?(?:headcount|workforce|team)",
        r"creating?\s+\d+\s+(?:new\s+)?jobs", r"\d+\s+new\s+(?:roles|jobs|hires)",
        r"recruitment\s+drive", r"workforce\s+expansion", r"mass\s+hiring",
        r"ramp(?:s|ing)?\s+up\s+(?:hiring|team)", r"boost(?:s|ing)?\s+team",
        r"growing\s+team", r"expanding\s+team", r"adds?\s+\d+\s+(?:jobs|roles)",
        r"plans?\s+to\s+add\s+\d+", r"job\s+creation", r"employment\s+drive",
    ],
    "m_and_a": [
        r"acquires?", r"acquisition\s+of", r"acquired\s+by",
        r"to\s+acquire", r"merger\b", r"merges?\s+with",
        r"buys?\s+out", r"takeover", r"bought\s+by", r"bought\s+out",
        r"majority\s+stake", r"minority\s+stake", r"controlling\s+stake",
        r"buys?\s+\d+%\s+stake", r"acquires?\s+\d+%",
        r"completes?\s+(?:deal|takeover|acquisition|merger)",
        r"consolidat(?:es?|ion)\s+with", r"absorbs?",
        r"snaps?\s+up", r"scoops?\s+up", r"picks?\s+up\s+\w+\s+for\s+\$",
        r"swallows?", r"combines?\s+with", r"divestment",
        r"carve-?out", r"spin-?off", r"sells?\s+(?:to|stake)",
    ],
    "executive": [
        r"appoints?\s+(?:new\s+)?(?:ceo|cto|cfo|coo|cmo|chief)",
        r"names?\s+(?:new\s+)?(?:ceo|cto|cfo|coo|cmo|chief|director|head)",
        r"new\s+chief\s+executive", r"appointed\s+chairman",
        r"new\s+chair\b", r"joins?\s+as\s+(?:ceo|cto|cfo|coo|cmo|chief|md|managing\s+director|president|head|vp|vice\s+president|director|general\s+manager|regional\s+director)",
        r"leadership\s+(?:change|transition|reshuffle)",
        r"steps?\s+down\s+as", r"resigns?\s+as\s+(?:ceo|cto|cfo|chairman)",
        r"promoted\s+to", r"elevated\s+to", r"tapped\s+as",
        r"picks?\s+(?:new\s+)?(?:ceo|cto|cfo|chief)",
        r"hires?\s+(?:new\s+)?(?:ceo|cto|cfo|chief|president|md)",
        r"new\s+(?:managing|regional|country)\s+director",
        r"new\s+general\s+manager", r"new\s+head\s+of",
        r"executive\s+appointment", r"board\s+(?:appointment|addition|change)",
        r"(?:ceo|cto|cfo|coo)\s+(?:departs|exits|leaves)",
        r"succeeds?\s+(?:as|in\s+the\s+role)", r"takes?\s+(?:over|the\s+reins)\s+as",
    ],
}


@dataclass
class SignalClassification:
    """Result of signal classification for an article."""
    signal_type: str
    confidence: float
    strength: str
    all_scores: Dict[str, float]


class ClassifierAgent:
    """Classifies articles into investment signal types."""

    def __init__(self, use_ml: bool = True):
        self._pipeline = None
        self._use_ml = use_ml
        self._ml_available = False
        self._embedding_agent = None

    def _load_pipeline(self):
        """Try to load the zero-shot classification pipeline."""
        if self._pipeline is not None or not self._use_ml:
            return

        # Try embedding-based classification first (lighter weight)
        try:
            from app.agents.embedding_agent import EmbeddingAgent
            self._embedding_agent = EmbeddingAgent()
            self._ml_available = True
            logger.info("classifier_using_embeddings")
            return
        except Exception:
            pass

        # Try transformers zero-shot pipeline
        try:
            from transformers import pipeline as hf_pipeline
            self._pipeline = hf_pipeline(
                "zero-shot-classification",
                model="facebook/bart-large-mnli",
                device=-1,  # CPU
            )
            self._ml_available = True
            logger.info("classifier_model_loaded model=bart-large-mnli")
        except ImportError:
            logger.warning(
                "transformers not installed. Using keyword fallback. "
                "Install with: pip install transformers torch"
            )
        except Exception as exc:
            logger.warning("classifier_model_load_failed err=%s", exc)

    def _keyword_classify(self, text: str) -> Dict[str, float]:
        """Fast keyword-based classification with regex patterns."""
        text_lower = text.lower()
        scores: Dict[str, float] = {}
        for signal_type, patterns in KEYWORD_PATTERNS.items():
            match_count = sum(
                1 for p in patterns if re.search(p, text_lower)
            )
            # Normalize: more matches = higher confidence (bumped from 0.3 to 0.4)
            scores[signal_type] = min(1.0, match_count * 0.4)
        return scores

    def _embedding_classify(self, text: str) -> Dict[str, float]:
        """Classify using embedding similarity to signal type descriptions."""
        if self._embedding_agent is None:
            return self._keyword_classify(text)

        text_emb = self._embedding_agent.encode(text)
        scores = {}
        for signal_type, description in SIGNAL_TYPE_LABELS.items():
            desc_emb = self._embedding_agent.encode(description)
            similarity = float(text_emb @ desc_emb)
            scores[signal_type] = float(max(0.0, min(1.0, similarity)))
        return scores

    def _zeroshot_classify(self, text: str) -> Dict[str, float]:
        """Classify using the transformers zero-shot pipeline."""
        if self._pipeline is None:
            return self._keyword_classify(text)

        labels = list(SIGNAL_TYPE_LABELS.values())
        label_to_type = {v: k for k, v in SIGNAL_TYPE_LABELS.items()}

        result = self._pipeline(
            text[:512],  # Truncate for model input
            candidate_labels=labels,
            multi_label=True,
        )

        scores = {}
        for label, score in zip(result["labels"], result["scores"]):
            signal_type = label_to_type.get(label, "")
            if signal_type:
                scores[signal_type] = float(score)
        return scores

    def _assess_strength(self, text: str, signal_type: str) -> str:
        """Determine signal strength based on content analysis."""
        text_lower = text.lower()

        # Check for high-strength indicators
        for pattern in SIGNAL_STRENGTH_RULES["high"]:
            if re.search(pattern, text_lower):
                return "high"

        # Check for low-strength (speculative) indicators
        for pattern in SIGNAL_STRENGTH_RULES["low"]:
            if re.search(pattern, text_lower):
                return "low"

        # Default to medium
        return "medium"

    def classify(self, text: str) -> SignalClassification:
        """
        Classify an article text into signal type with confidence.

        Uses ML model if available, falls back to keyword matching.
        Returns the best signal type and confidence score.
        """
        self._load_pipeline()

        # Get scores from all available methods
        keyword_scores = self._keyword_classify(text)

        if self._ml_available and self._embedding_agent:
            ml_scores = self._embedding_classify(text)
            # Blend: 60% ML, 40% keywords
            scores = {
                k: 0.6 * ml_scores.get(k, 0) + 0.4 * keyword_scores.get(k, 0)
                for k in set(list(ml_scores.keys()) + list(keyword_scores.keys()))
            }
        elif self._ml_available and self._pipeline:
            ml_scores = self._zeroshot_classify(text)
            scores = {
                k: 0.7 * ml_scores.get(k, 0) + 0.3 * keyword_scores.get(k, 0)
                for k in set(list(ml_scores.keys()) + list(keyword_scores.keys()))
            }
        else:
            scores = keyword_scores

        # Find best signal type
        if not scores or max(scores.values()) < 0.05:
            return SignalClassification(
                signal_type="launch",
                confidence=0.0,
                strength="low",
                all_scores=scores,
            )

        best_type = max(scores, key=scores.get)  # type: ignore
        confidence = scores[best_type]
        strength = self._assess_strength(text, best_type)

        return SignalClassification(
            signal_type=best_type,
            confidence=confidence,
            strength=strength,
            all_scores=scores,
        )

    def classify_batch(
        self, texts: List[str]
    ) -> List[SignalClassification]:
        """Classify multiple texts efficiently."""
        return [self.classify(text) for text in texts]

    def is_investment_signal(self, text: str, threshold: float = 0.15) -> bool:
        """Quick check: does this text contain any investment signal?"""
        result = self.classify(text)
        return result.confidence >= threshold

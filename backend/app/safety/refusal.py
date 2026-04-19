"""Hard-refusal guard for regulated activity.

The Ministry's signal detection tool MUST NOT emit personalised investment
advice, insider-information analysis, sanction-evasion guidance, or anything
resembling legal/tax advice. These are out-of-scope for a surveillance tool
and would expose the Ministry to regulatory risk.

This module is a deterministic pre-check. If it fires, the AI client
short-circuits and writes an audit entry without calling the model at all.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Optional


REFUSAL_PATTERNS: List[tuple[str, re.Pattern]] = [
    # Personalised financial advice
    ("personal_investment_advice",
     re.compile(r"\bgive\s+me\s+(?:specific\s+|personal\s+|concrete\s+)?"
                r"(?:investment|trading|legal|tax)\s+advice\b", re.I)),
    ("personal_investment_advice",
     re.compile(r"\bshould\s+I\s+(?:buy|sell|short|invest\s+in|divest\s+from)\b", re.I)),
    # Insider information
    ("insider_information",
     re.compile(r"\binsider\s+(?:information|tip|trade|knowledge)\b", re.I)),
    ("insider_information",
     re.compile(r"\bnon-?public\s+(?:information|material)\b", re.I)),
    # Sanctions evasion
    ("sanctions_evasion",
     re.compile(r"\b(?:evade|bypass|circumvent|sidestep|get\s+around)\s+"
                r"(?:the\s+)?(?:ofac\s+|un\s+|eu\s+|us\s+)?sanctions?\b", re.I)),
    ("sanctions_evasion",
     re.compile(r"\bhow\s+to\s+(?:skirt|avoid|evade|bypass)\s+ofac\b", re.I)),
    # Market manipulation
    ("market_manipulation",
     re.compile(r"\b(?:pump\s+and\s+dump|wash\s+trading|front-?running)\b", re.I)),
    ("market_manipulation",
     re.compile(r"\bmanipulate\s+(?:the\s+)?(?:price|market|share\s+price)\b", re.I)),
    # Sovereign / political analysis the tool is not designed for
    ("political_analysis",
     re.compile(r"\bpredict\s+(?:the\s+)?(?:election|regime\s+change)\b", re.I)),
]


@dataclass(frozen=True)
class RefusalDecision:
    refuse: bool
    category: Optional[str] = None
    matched: Optional[str] = None


class RegulatedActivityGuard:
    """Swappable refusal rule-set so policy updates are unit-testable."""

    def __init__(self) -> None:
        self.patterns = list(REFUSAL_PATTERNS)

    def evaluate(self, prompt: str) -> RefusalDecision:
        if not prompt:
            return RefusalDecision(refuse=False)
        for category, pat in self.patterns:
            m = pat.search(prompt)
            if m:
                return RefusalDecision(
                    refuse=True,
                    category=category,
                    matched=m.group(0),
                )
        return RefusalDecision(refuse=False)


_default_guard = RegulatedActivityGuard()


def should_refuse(prompt: str) -> RefusalDecision:
    return _default_guard.evaluate(prompt)

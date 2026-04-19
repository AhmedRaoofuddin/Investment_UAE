"""PII redaction for outgoing signals.

Every signal surfaced to an analyst, pushed to a Slack/email channel, or
written to an audit log passes through this redactor. The rule-set is
UAE-specific: Emirates ID, UAE mobile, IBAN starting AE, plus the usual
email/phone generics. PDPL Article 10 (data minimisation) requires that we
don't retain PII we don't need.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Dict, List, Tuple


# Order matters — more-specific patterns run first so they can't be clobbered
# by the generic phone matcher.
PII_PATTERNS: List[tuple[str, re.Pattern]] = [
    # Emirates ID: 784-YYYY-NNNNNNN-N (15 digits total, optional dashes)
    ("emirates_id", re.compile(r"\b784[-\s]?\d{4}[-\s]?\d{7}[-\s]?\d\b")),
    # UAE IBAN — always starts with AE + 2 check digits + 19 digits
    ("iban_ae", re.compile(r"\bAE\d{2}\d{19}\b")),
    # Email
    ("email", re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")),
    # UAE mobile: +971, 00971, or 0 followed by 5X...
    ("phone_uae", re.compile(r"(?:\+?971|00971|0)5\d{8}\b")),
    # Generic international phone (E.164-ish)
    ("phone_intl", re.compile(r"\+\d{1,3}[\s-]?\d{3,4}[\s-]?\d{3,4}[\s-]?\d{3,4}")),
]


@dataclass
class RedactionResult:
    text: str
    redactions: Dict[str, int] = field(default_factory=dict)

    @property
    def redacted_count(self) -> int:
        return sum(self.redactions.values())


class PIIRedactor:
    """Swappable redactor so tests can assert on exact counts."""

    def __init__(self) -> None:
        self.patterns = list(PII_PATTERNS)

    def redact(self, text: str) -> RedactionResult:
        if not text:
            return RedactionResult(text="", redactions={})
        out = text
        counts: Dict[str, int] = {}
        for name, pat in self.patterns:
            new_out, n = pat.subn(f"[REDACTED-{name.upper()}]", out)
            if n > 0:
                counts[name] = counts.get(name, 0) + n
                out = new_out
        return RedactionResult(text=out, redactions=counts)


_default = PIIRedactor()


def redact(text: str) -> RedactionResult:
    return _default.redact(text)

"""Prompt-injection detection for untrusted text before it reaches the LLM.

The signal extractor concatenates article bodies and titles into a user
message sent to Claude. An attacker controlling an article (think: sponsored
content on a low-trust site) could embed "IGNORE PREVIOUS INSTRUCTIONS"
and steer the model. This module scans every untrusted span and either
annotates or rejects it.

The patterns mirror Lakera Guard / Pillar Security public rule-sets, trimmed
to the classes we've actually seen hit news-feed content. Deliberately
permissive — a 1% false-negative rate is preferable to a 5% false-positive
rate that would block legitimate financial-news text.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List


# Instruction-override / persona-takeover
INSTRUCTION_OVERRIDE = [
    re.compile(r"ignore\s+(?:all\s+|the\s+)?(?:previous|above|prior)\s+(?:instructions|prompt|context|rules)", re.I),
    re.compile(r"disregard\s+(?:all\s+|the\s+)?(?:previous|above|prior)\s+(?:instructions|prompt|rules)", re.I),
    re.compile(r"you\s+are\s+now\s+(?:a\s+|an\s+)?(?:different|new)\s+(?:assistant|ai|model|persona|chatbot)", re.I),
    re.compile(r"(?:reveal|show|print|output|dump|leak)\s+(?:your\s+|the\s+)?(?:system\s+)?prompt", re.I),
    re.compile(r"(?:^|\n)\s*system\s*[:>]\s*", re.I),
    re.compile(r"(?:^|\n)\s*assistant\s*[:>]\s*", re.I),
    re.compile(r"<\|im_(?:start|end)\|>", re.I),
    re.compile(r"\bdeveloper\s+mode\b", re.I),
    re.compile(r"\bjailbreak\b", re.I),
    re.compile(r"pretend\s+you\s+are\s+(?:an?\s+)?(?:unrestricted|uncensored)", re.I),
]

# Credential / secret exfiltration
SECRET_EXFIL = [
    re.compile(r"\bsk-(?:ant-|live_|test_)[A-Za-z0-9_-]{20,}", re.I),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b"),
    re.compile(r"\bghp_[A-Za-z0-9]{36,}\b"),
]

# Data-exfil channels (system asked to POST to an external URL, etc.)
EXFIL_CHANNEL = [
    re.compile(r"(?:send|post|exfiltrate|upload)\s+(?:the\s+)?(?:data|results|output|prompt)\s+to\s+https?://", re.I),
    re.compile(r"\bcurl\s+-[xX]\s+post\b", re.I),
]

# Known delimiter / role spoof tokens
DELIMITER_SPOOF = [
    re.compile(r"\[\s*INST\s*\]", re.I),
    re.compile(r"\[\s*/INST\s*\]", re.I),
    re.compile(r"###\s*(?:system|instruction|human)\s*###", re.I),
]


@dataclass(frozen=True)
class InjectionFinding:
    category: str
    pattern: str
    snippet: str


class InjectionGuard:
    """Stateful scanner so rule-sets can be swapped in tests without monkey-
    patching module globals."""

    def __init__(self) -> None:
        self.rules = {
            "instruction_override": INSTRUCTION_OVERRIDE,
            "secret_exfil": SECRET_EXFIL,
            "exfil_channel": EXFIL_CHANNEL,
            "delimiter_spoof": DELIMITER_SPOOF,
        }

    def scan(self, text: str) -> List[InjectionFinding]:
        """Return every matching finding. Empty list means the text is
        safe to concatenate into a prompt."""
        if not text:
            return []
        findings: List[InjectionFinding] = []
        for category, patterns in self.rules.items():
            for pat in patterns:
                m = pat.search(text)
                if m:
                    start = max(0, m.start() - 20)
                    end = min(len(text), m.end() + 20)
                    findings.append(
                        InjectionFinding(
                            category=category,
                            pattern=pat.pattern,
                            snippet=text[start:end],
                        )
                    )
        return findings

    def is_safe(self, text: str) -> bool:
        return not self.scan(text)


_default_guard = InjectionGuard()


def scan_untrusted(text: str) -> List[InjectionFinding]:
    return _default_guard.scan(text)

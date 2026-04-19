"""UAE-grade safety taxonomy for the Invest UAE signal pipeline.

Exports deterministic guards that run before any LLM call AND as a last-mile
scrub on every outgoing signal. Designed to align with:

- PDPL (UAE Personal Data Protection Law) Article 10/23: data minimisation and
  auditability
- ADGM / DIFC AML-CFT rulebook: sanctions + PEP pre-screening
- Ministry of Investment national priorities: sector alignment, strategic
  sovereignty controls

Each module here is pure Python (no network, no LLM) so every decision is
reproducible, testable, and forensically defensible.
"""

from app.safety.sanctions import SanctionsScreen, is_sanctioned
from app.safety.injection import InjectionGuard, scan_untrusted
from app.safety.refusal import RegulatedActivityGuard, should_refuse
from app.safety.pii import PIIRedactor, redact

__all__ = [
    "SanctionsScreen",
    "is_sanctioned",
    "InjectionGuard",
    "scan_untrusted",
    "RegulatedActivityGuard",
    "should_refuse",
    "PIIRedactor",
    "redact",
]

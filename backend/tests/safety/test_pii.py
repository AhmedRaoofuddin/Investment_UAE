"""PII redaction.

Every outgoing signal passes through `redact`. Failure here = PDPL Article 10
violation. We pin exact redaction counts and token formats so regressions
are caught on the first CI run.
"""
from __future__ import annotations

import pytest

from app.safety.pii import PIIRedactor, redact


pytestmark = pytest.mark.safety


class TestEmiratesID:
    def test_dashed_format_redacted(self) -> None:
        r = redact("Contact: 784-1990-1234567-8 for details")
        assert r.redactions.get("emirates_id") == 1
        assert "[REDACTED-EMIRATES_ID]" in r.text
        assert "784-1990" not in r.text

    def test_spaced_format_redacted(self) -> None:
        r = redact("ID 784 1990 1234567 8")
        assert r.redactions.get("emirates_id") == 1

    def test_undashed_format_redacted(self) -> None:
        r = redact("id 784199012345678")
        assert r.redactions.get("emirates_id") == 1


class TestUAEMobile:
    @pytest.mark.parametrize("number", [
        "+971501234567",
        "00971501234567",
        "0501234567",
    ])
    def test_all_uae_prefixes_redacted(self, number: str) -> None:
        r = redact(f"Call me on {number} to confirm")
        assert r.redactions.get("phone_uae", 0) >= 1, r.redactions


class TestIBAN:
    def test_ae_iban_redacted(self) -> None:
        # AE + 2 check digits + 19 digits
        iban = "AE07" + "0" * 19
        r = redact(f"Transfer to {iban} immediately")
        assert r.redactions.get("iban_ae") == 1
        assert "[REDACTED-IBAN_AE]" in r.text


class TestEmail:
    def test_email_redacted(self) -> None:
        r = redact("Reach out to analyst@ministry.gov.ae for the report")
        assert r.redactions.get("email") == 1


class TestSignalContentPreserved:
    """Redaction MUST NOT destroy the surrounding narrative. A signal
    body "X raises $67M in Series B" with no PII must come through
    byte-identical."""

    def test_clean_signal_unchanged(self) -> None:
        body = "Lean Technologies raises $67M in Series B led by General Catalyst"
        r = redact(body)
        assert r.text == body
        assert r.redactions == {}

    def test_mixed_content_redacts_only_pii(self) -> None:
        body = (
            "Lean Technologies raises $67M Series B. "
            "Press contact: press@lean.tech. "
            "Call +971501234567 for details."
        )
        r = redact(body)
        assert "Lean Technologies raises $67M" in r.text
        assert "press@lean.tech" not in r.text
        assert "+971501234567" not in r.text
        assert r.redactions.get("email") == 1
        assert r.redactions.get("phone_uae") == 1


class TestRedactorConstruction:
    def test_swappable_rule_set(self) -> None:
        r = PIIRedactor()
        r.patterns = []
        result = r.redact("email: test@example.com and +971501234567")
        assert result.text == "email: test@example.com and +971501234567"
        assert result.redactions == {}

    def test_empty_returns_empty(self) -> None:
        r = redact("")
        assert r.text == ""
        assert r.redactions == {}

    def test_redacted_count_aggregate(self) -> None:
        body = "a@b.com +971501111111 AE" + "0" * 2 + "0" * 19
        r = redact(body)
        # email + phone + iban = 3
        assert r.redacted_count == 3

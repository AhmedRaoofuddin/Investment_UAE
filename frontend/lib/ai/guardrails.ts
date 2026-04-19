// Lightweight prompt-injection + PII guardrails.
//
// This is a defence-in-depth layer, NOT a full-blown firewall. The proper
// answer for v3 is Lakera Guard or Pillar Security in front of every LLM
// call. For the pilot we use deterministic rules to catch the obvious
// classes (instruction injection, secret exfiltration, PII leak in output).
//
// The patterns are deliberately permissive — we'd rather let through 1%
// false-negatives than block 5% of legitimate financial-news text. Anything
// flagged here is logged via `audit()` upstream so ops can tune.

const INSTRUCTION_INJECTION_PATTERNS: RegExp[] = [
  /ignore (?:all |the )?(?:previous|above|prior) (?:instructions|prompt|context)/i,
  /disregard (?:all |the )?(?:previous|above|prior) (?:instructions|prompt|rules)/i,
  /you are now (?:a |an )?(?:different|new) (?:assistant|ai|model|persona)/i,
  /(?:reveal|show|print|output) (?:your |the )?(?:system )?prompt/i,
  /(?:^|\n)\s*system\s*[:>]\s*/i,
  /(?:^|\n)\s*assistant\s*[:>]\s*/i,
  /<\|im_(?:start|end)\|>/i, // chatml-style takeover
  /\bdeveloper mode\b/i,
  /\bjailbreak\b/i,
];

const SECRET_PATTERNS: RegExp[] = [
  /\bsk-(?:ant-|live_|test_)[A-Za-z0-9_-]{20,}/g, // Anthropic / Stripe-ish
  /\bAKIA[0-9A-Z]{16}\b/g, // AWS access key
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g, // JWT
  /\bghp_[A-Za-z0-9]{36,}\b/g, // GitHub PAT
];

// PII patterns — UAE-relevant set. Email + phone + Emirates ID + IBAN.
const PII_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "email", re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g },
  { name: "phone-uae", re: /\b(?:\+?971|0)?5[0-9]{8}\b/g },
  // Emirates ID: 784-YYYY-NNNNNNN-N
  { name: "emirates-id", re: /\b784-?\d{4}-?\d{7}-?\d\b/g },
  // IBAN, generic — UAE format starts with AE.
  { name: "iban-ae", re: /\bAE\d{2}\d{19}\b/g },
];

export interface GuardResult {
  allowed: boolean;
  reasons: string[];
}

/**
 * Inspect untrusted input (article body, MCP tool result, user free text)
 * before it's concatenated into an LLM prompt. Returns allowed=false if
 * the text contains an instruction-injection pattern OR a secret that
 * shouldn't reach the model. Always-allowed fields (titles, urls) should
 * not go through this — only free-form text.
 */
export function guardInput(text: string): GuardResult {
  const reasons: string[] = [];
  for (const re of INSTRUCTION_INJECTION_PATTERNS) {
    if (re.test(text)) {
      reasons.push("prompt-injection-suspected");
      break;
    }
  }
  for (const re of SECRET_PATTERNS) {
    if (re.test(text)) {
      reasons.push("secret-pattern-detected");
      break;
    }
  }
  return { allowed: reasons.length === 0, reasons };
}

/**
 * Scrub model output before it's surfaced in the UI / sent over a
 * notification channel. Returns the scrubbed text and a list of redactions.
 * Email addresses in news context are usually fine, so we only redact when
 * the caller explicitly asks (e.g. before sending over WhatsApp).
 */
export interface ScrubOptions {
  redactPii?: boolean;
  redactSecrets?: boolean;
}

export interface ScrubResult {
  text: string;
  redactions: { kind: string; count: number }[];
}

export function scrubOutput(
  text: string,
  opts: ScrubOptions = { redactSecrets: true },
): ScrubResult {
  let out = text;
  const redactions: { kind: string; count: number }[] = [];

  if (opts.redactSecrets) {
    for (const re of SECRET_PATTERNS) {
      let count = 0;
      out = out.replace(re, () => {
        count++;
        return "[REDACTED-SECRET]";
      });
      if (count > 0) redactions.push({ kind: "secret", count });
    }
  }

  if (opts.redactPii) {
    for (const { name, re } of PII_PATTERNS) {
      let count = 0;
      out = out.replace(re, () => {
        count++;
        return `[REDACTED-${name.toUpperCase()}]`;
      });
      if (count > 0) redactions.push({ kind: name, count });
    }
  }

  return { text: out, redactions };
}

/**
 * Hard-refuse list. Used by the AI client to short-circuit calls that look
 * like regulated activity (investment advice generation, PEP analysis, etc.)
 * before they hit the model. The frontend never offers UI for these — this
 * is a backstop in case input arrives via API.
 */
const REFUSAL_PATTERNS: RegExp[] = [
  /\bgive me (?:specific |personal |concrete )?(?:investment|trading|legal|tax) advice\b/i,
  /\bshould I (?:buy|sell|short|invest in)\b/i,
  /\binsider (?:information|tip|trade)\b/i,
];

export function shouldRefuse(prompt: string): { refuse: boolean; reason?: string } {
  for (const re of REFUSAL_PATTERNS) {
    if (re.test(prompt)) {
      return { refuse: true, reason: "regulated-activity-out-of-scope" };
    }
  }
  return { refuse: false };
}

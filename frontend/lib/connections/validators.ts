// Per-connector credential validation.
//
// Runs on the save route BEFORE anything hits the DB or the encryption
// layer. Two layers:
//
//   1. Shape — synchronous regex / hostname / query-param rules. Catches
//      obvious paste-something-random mistakes (e.g. pasting
//      https://metaforgeportal.com/ into the Slack webhook field).
//   2. Handshake — live probe against the vendor. 5s timeout. Catches
//      typos and revoked credentials that look structurally valid.
//
// Handshake requests are fire-and-forget probes: they must not leave
// durable state on the vendor side (other than a single test message in
// the target channel for outbound-webhook connectors; this is the
// documented cost of a real end-to-end check).
//
// Failures return a structured result so the UI can render a per-field
// error banner. Audit trail happens in the save route, not here.
//
// Not in scope today: SSRF hardening (RFC1918 / link-local / metadata
// endpoint blocking) for the user-hosted probes (`webhook-generic`,
// `n8n`, `tableau-webhook`, `mcp-endpoint`). Tracked for GA.

import { getConnector } from "@/lib/connections/catalogue";

// ─────────────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────────────

export interface ValidationOk {
  ok: true;
}

export interface ValidationFail {
  ok: false;
  stage: "shape" | "handshake";
  field: string;
  detail: string;
  /** Human-readable example of what the field should look like. */
  expected?: string;
}

export type ValidationResult = ValidationOk | ValidationFail;

const OK: ValidationOk = { ok: true };

function fail(
  stage: "shape" | "handshake",
  field: string,
  detail: string,
  expected?: string,
): ValidationFail {
  return { ok: false, stage, field, detail, expected };
}

// ─────────────────────────────────────────────────────────────────────
// Shared fetch helper with 5s timeout. Node 20+ / modern runtimes
// support AbortSignal.timeout; we fall back to AbortController for
// older environments.
// ─────────────────────────────────────────────────────────────────────

const HANDSHAKE_TIMEOUT_MS = 5_000;
const PROBE_USER_AGENT = "InvestUAE-Signals/1.0 (+connector-handshake)";

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = HANDSHAKE_TIMEOUT_MS,
): Promise<Response> {
  // Prefer the standard helper; fall back for older runtimes.
  let signal: AbortSignal;
  if (typeof AbortSignal.timeout === "function") {
    signal = AbortSignal.timeout(timeoutMs);
  } else {
    const ac = new AbortController();
    setTimeout(() => ac.abort(), timeoutMs);
    signal = ac.signal;
  }
  const headers = new Headers(init.headers ?? {});
  if (!headers.has("User-Agent")) headers.set("User-Agent", PROBE_USER_AGENT);
  return fetch(url, { ...init, headers, signal });
}

function describeFetchError(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      return "Request timed out after 5s.";
    }
    return err.message;
  }
  return "Network error contacting the vendor.";
}

// ─────────────────────────────────────────────────────────────────────
// Shape helpers
// ─────────────────────────────────────────────────────────────────────

function asUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function hostMatches(host: string, pattern: RegExp): boolean {
  return pattern.test(host.toLowerCase());
}

// ─────────────────────────────────────────────────────────────────────
// Shape rules — one per connector. Called first.
// ─────────────────────────────────────────────────────────────────────

type ShapeRule = (fields: Record<string, string>) => ValidationResult;

const SHAPE: Record<string, ShapeRule> = {
  "slack-webhook": (f) => {
    const url = (f.webhook_url ?? "").trim();
    if (!url) return OK;
    const pattern = /^https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]{20,}$/;
    if (!pattern.test(url)) {
      return fail(
        "shape",
        "webhook_url",
        "Slack incoming webhook URLs must be on hooks.slack.com and follow the /services/T…/B…/<token> pattern.",
        "https://hooks.slack.com/services/T<team>/B<bot>/<secret>",
      );
    }
    return OK;
  },

  "teams-webhook": (f) => {
    const url = (f.webhook_url ?? "").trim();
    if (!url) return OK;
    const u = asUrl(url);
    if (!u) return fail("shape", "webhook_url", "Not a valid URL.");
    const okHost = hostMatches(u.hostname, /(^|\.)webhook\.office\.com$/) ||
      hostMatches(u.hostname, /(^|\.)outlook\.office\.com$/);
    const okPath = u.pathname.includes("/webhookb2/");
    if (!okHost || !okPath) {
      return fail(
        "shape",
        "webhook_url",
        "Teams incoming webhook URLs must be on *.webhook.office.com and include /webhookb2/ in the path.",
        "https://<tenant>.webhook.office.com/webhookb2/...",
      );
    }
    return OK;
  },

  "google-chat": (f) => {
    const url = (f.webhook_url ?? "").trim();
    if (!url) return OK;
    const u = asUrl(url);
    if (!u || u.hostname !== "chat.googleapis.com") {
      return fail(
        "shape",
        "webhook_url",
        "Google Chat webhook URLs must be on chat.googleapis.com.",
        "https://chat.googleapis.com/v1/spaces/.../messages?key=...&token=...",
      );
    }
    if (!u.pathname.startsWith("/v1/spaces/") || !u.pathname.endsWith("/messages")) {
      return fail("shape", "webhook_url", "URL must point at /v1/spaces/<id>/messages.");
    }
    if (!u.searchParams.get("key") || !u.searchParams.get("token")) {
      return fail(
        "shape",
        "webhook_url",
        "URL is missing the required key= and token= query parameters.",
      );
    }
    return OK;
  },

  "google-sheets-webhook": (f) => {
    const url = (f.webhook_url ?? "").trim();
    if (!url) return OK;
    const pattern = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec(\?.*)?$/;
    if (!pattern.test(url)) {
      return fail(
        "shape",
        "webhook_url",
        "Apps Script web app URLs must be on script.google.com and end with /exec.",
        "https://script.google.com/macros/s/AKfycbx.../exec",
      );
    }
    return OK;
  },

  "power-bi": (f) => {
    const url = (f.push_url ?? "").trim();
    if (!url) return OK;
    const u = asUrl(url);
    if (!u || u.hostname !== "api.powerbi.com") {
      return fail(
        "shape",
        "push_url",
        "Power BI push URLs must be on api.powerbi.com.",
        "https://api.powerbi.com/beta/<tenant>/datasets/<id>/rows?key=...",
      );
    }
    if (!/\/datasets\/[0-9a-f-]{10,}\/rows$/i.test(u.pathname)) {
      return fail("shape", "push_url", "Path must end with /datasets/<id>/rows.");
    }
    if (!u.searchParams.get("key")) {
      return fail("shape", "push_url", "URL is missing the required key= query parameter.");
    }
    return OK;
  },

  zapier: (f) => {
    const url = (f.webhook_url ?? "").trim();
    if (!url) return OK;
    const pattern = /^https:\/\/hooks\.zapier\.com\/hooks\/catch\/\d+\/[A-Za-z0-9]+\/?$/;
    if (!pattern.test(url)) {
      return fail(
        "shape",
        "webhook_url",
        "Zapier Catch Hook URLs must be on hooks.zapier.com.",
        "https://hooks.zapier.com/hooks/catch/12345678/abcdef/",
      );
    }
    return OK;
  },

  make: (f) => {
    const url = (f.webhook_url ?? "").trim();
    if (!url) return OK;
    const u = asUrl(url);
    if (!u) return fail("shape", "webhook_url", "Not a valid URL.");
    const ok = hostMatches(u.hostname, /^hook\.[a-z0-9-]+\.make\.com$/) ||
      hostMatches(u.hostname, /^hook\.integromat\.com$/);
    if (!ok) {
      return fail(
        "shape",
        "webhook_url",
        "Make webhook URLs must be on hook.<region>.make.com (or legacy hook.integromat.com).",
        "https://hook.eu2.make.com/<id>",
      );
    }
    return OK;
  },

  "power-automate": (f) => validateAzureHttpTrigger(f, "webhook_url"),
  "azure-logic-apps": (f) => validateAzureHttpTrigger(f, "webhook_url"),

  "email-resend": (f) => {
    const key = (f.api_key ?? "").trim();
    if (key && !key.startsWith("re_")) {
      return fail(
        "shape",
        "api_key",
        "Resend API keys start with re_.",
        "re_abc123...",
      );
    }
    const from = (f.from ?? "").trim();
    if (from && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)) {
      return fail("shape", "from", "From address must be a valid email.");
    }
    return OK;
  },

  airtable: (f) => {
    const key = (f.api_key ?? "").trim();
    if (key && !key.startsWith("pat")) {
      return fail(
        "shape",
        "api_key",
        "Airtable personal access tokens start with pat.",
        "patXXXXXXXXXXXXXX.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      );
    }
    const baseId = (f.base_id ?? "").trim();
    if (baseId && !/^app[A-Za-z0-9]{14}$/.test(baseId)) {
      return fail(
        "shape",
        "base_id",
        "Airtable base IDs start with app and are 17 characters total.",
        "appXXXXXXXXXXXXXX",
      );
    }
    return OK;
  },

  "notion-api": (f) => {
    const key = (f.api_key ?? "").trim();
    if (key && !(key.startsWith("secret_") || key.startsWith("ntn_"))) {
      return fail(
        "shape",
        "api_key",
        "Notion integration tokens start with secret_ (or ntn_ for newer ones).",
        "secret_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      );
    }
    const id = (f.database_id ?? "").trim().replace(/-/g, "");
    if (id && !/^[0-9a-f]{32}$/i.test(id)) {
      return fail(
        "shape",
        "database_id",
        "Notion database IDs are 32-character hex strings (dashes optional).",
        "a1b2c3d4e5f67890a1b2c3d4e5f67890",
      );
    }
    return OK;
  },

  "whatsapp-meta": (f) => {
    const phoneId = (f.phone_number_id ?? "").trim();
    if (phoneId && !/^\d{5,20}$/.test(phoneId)) {
      return fail("shape", "phone_number_id", "Phone number ID must be digits only.");
    }
    const token = (f.access_token ?? "").trim();
    if (token && !token.startsWith("EAA")) {
      return fail(
        "shape",
        "access_token",
        "Meta system-user access tokens start with EAA.",
        "EAAXXXXXXXXXX...",
      );
    }
    return OK;
  },

  "azure-devops": (f) => {
    const org = (f.organization ?? "").trim();
    if (org && !/^[a-z0-9][a-z0-9-]{1,49}$/i.test(org)) {
      return fail(
        "shape",
        "organization",
        "Azure DevOps organisation names are 2–50 chars, letters/digits/hyphens.",
      );
    }
    return OK;
  },

  // User-hosted endpoints — no shared shape beyond HTTPS (already enforced
  // by the save route's URL-type check). We still hostname-sanity the
  // URL to block obvious mistakes like http://localhost etc.
  "webhook-generic": (f) => mustBeHttpsUrl(f.webhook_url, "webhook_url"),
  n8n: (f) => mustBeHttpsUrl(f.webhook_url, "webhook_url"),
  "tableau-webhook": (f) => mustBeHttpsUrl(f.webhook_url, "webhook_url"),
  "mcp-endpoint": (f) => mustBeHttpsUrl(f.endpoint_url, "endpoint_url"),
};

function mustBeHttpsUrl(raw: string | undefined, fieldName: string): ValidationResult {
  const url = (raw ?? "").trim();
  if (!url) return OK;
  const u = asUrl(url);
  if (!u || u.protocol !== "https:") {
    return fail("shape", fieldName, "Must be a valid HTTPS URL.");
  }
  return OK;
}

function validateAzureHttpTrigger(
  fields: Record<string, string>,
  fieldName: string,
): ValidationResult {
  const url = (fields[fieldName] ?? "").trim();
  if (!url) return OK;
  const u = asUrl(url);
  if (!u) return fail("shape", fieldName, "Not a valid URL.");
  const okHost = hostMatches(u.hostname, /^prod-[0-9a-z-]+\.[a-z0-9-]+\.logic\.azure\.com$/);
  if (!okHost) {
    return fail(
      "shape",
      fieldName,
      "Azure HTTP trigger URLs must be on prod-*.<region>.logic.azure.com.",
      "https://prod-00.eastus.logic.azure.com:443/workflows/.../triggers/manual/paths/invoke?...&sig=...",
    );
  }
  if (!u.pathname.includes("/workflows/")) {
    return fail("shape", fieldName, "Path must include /workflows/.");
  }
  if (!u.searchParams.get("sig")) {
    return fail("shape", fieldName, "URL is missing the required sig= query parameter.");
  }
  return OK;
}

// ─────────────────────────────────────────────────────────────────────
// Handshake rules — fired only if shape passes and at least one secret
// field is present (so updates that keep existing ciphertext are
// skipped). Each rule returns its own ValidationResult.
// ─────────────────────────────────────────────────────────────────────

type HandshakeRule = (fields: Record<string, string>) => Promise<ValidationResult>;

const TEST_MSG_TEXT = "Invest UAE connection test — ignore. This message confirms your connector is reachable.";

async function probeWebhook(
  url: string,
  body: unknown,
  fieldName: string,
  extraHeaders: Record<string, string> = {},
): Promise<ValidationResult> {
  try {
    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-InvestUAE-Test": "true",
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const snippet = (await res.text().catch(() => "")).slice(0, 160);
      return fail(
        "handshake",
        fieldName,
        `Vendor returned HTTP ${res.status}${snippet ? ` — ${snippet}` : ""}.`,
      );
    }
    return OK;
  } catch (err) {
    return fail("handshake", fieldName, describeFetchError(err));
  }
}

const HANDSHAKE: Record<string, HandshakeRule> = {
  "slack-webhook": (f) =>
    probeWebhook(f.webhook_url, { text: TEST_MSG_TEXT }, "webhook_url"),

  "teams-webhook": (f) =>
    probeWebhook(
      f.webhook_url,
      {
        "@type": "MessageCard",
        "@context": "https://schema.org/extensions",
        summary: "Invest UAE connection test",
        text: TEST_MSG_TEXT,
      },
      "webhook_url",
    ),

  "google-chat": (f) => probeWebhook(f.webhook_url, { text: TEST_MSG_TEXT }, "webhook_url"),

  "google-sheets-webhook": (f) =>
    probeWebhook(f.webhook_url, { test: true, source: "investuae" }, "webhook_url"),

  "power-bi": (f) => probeWebhook(f.push_url, [], "push_url"),

  zapier: (f) =>
    probeWebhook(f.webhook_url, { test: true, source: "investuae" }, "webhook_url"),
  make: (f) =>
    probeWebhook(f.webhook_url, { test: true, source: "investuae" }, "webhook_url"),
  n8n: (f) => {
    const headers: Record<string, string> = {};
    const name = (f.auth_header_name ?? "").trim();
    const value = (f.auth_header_value ?? "").trim();
    if (name && value) headers[name] = value;
    return probeWebhook(
      f.webhook_url,
      { test: true, source: "investuae" },
      "webhook_url",
      headers,
    );
  },
  "power-automate": (f) =>
    probeWebhook(f.webhook_url, { test: true, source: "investuae" }, "webhook_url"),
  "azure-logic-apps": (f) =>
    probeWebhook(f.webhook_url, { test: true, source: "investuae" }, "webhook_url"),
  "tableau-webhook": (f) => {
    const headers: Record<string, string> = {};
    const bearer = (f.auth_header ?? "").trim();
    if (bearer) headers["Authorization"] = `Bearer ${bearer}`;
    return probeWebhook(
      f.webhook_url,
      { test: true, source: "investuae" },
      "webhook_url",
      headers,
    );
  },
  "webhook-generic": (f) => {
    const headers: Record<string, string> = {};
    const name = (f.auth_header_name ?? "").trim();
    const value = (f.auth_header_value ?? "").trim();
    if (name && value) headers[name] = value;
    return probeWebhook(
      f.webhook_url,
      { test: true, source: "investuae" },
      "webhook_url",
      headers,
    );
  },

  "email-resend": async (f) => {
    const key = (f.api_key ?? "").trim();
    if (!key) return OK;
    try {
      const res = await fetchWithTimeout("https://api.resend.com/domains", {
        method: "GET",
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!res.ok) {
        return fail(
          "handshake",
          "api_key",
          `Resend returned HTTP ${res.status}. The API key is likely invalid or revoked.`,
        );
      }
      return OK;
    } catch (err) {
      return fail("handshake", "api_key", describeFetchError(err));
    }
  },

  airtable: async (f) => {
    const key = (f.api_key ?? "").trim();
    const baseId = (f.base_id ?? "").trim();
    if (!key || !baseId) return OK;
    try {
      const res = await fetchWithTimeout(
        `https://api.airtable.com/v0/meta/bases/${encodeURIComponent(baseId)}/tables`,
        { headers: { Authorization: `Bearer ${key}` } },
      );
      if (!res.ok) {
        const field = res.status === 404 ? "base_id" : "api_key";
        return fail(
          "handshake",
          field,
          `Airtable returned HTTP ${res.status}. Check the token and base ID, and that the token has schema.bases:read scope on this base.`,
        );
      }
      return OK;
    } catch (err) {
      return fail("handshake", "api_key", describeFetchError(err));
    }
  },

  "notion-api": async (f) => {
    const key = (f.api_key ?? "").trim();
    const dbId = (f.database_id ?? "").trim();
    if (!key || !dbId) return OK;
    try {
      const res = await fetchWithTimeout(
        `https://api.notion.com/v1/databases/${encodeURIComponent(dbId)}`,
        {
          headers: {
            Authorization: `Bearer ${key}`,
            "Notion-Version": "2022-06-28",
          },
        },
      );
      if (!res.ok) {
        const field = res.status === 404 ? "database_id" : "api_key";
        return fail(
          "handshake",
          field,
          `Notion returned HTTP ${res.status}. Make sure the integration is added to this database via its Connections menu.`,
        );
      }
      return OK;
    } catch (err) {
      return fail("handshake", "api_key", describeFetchError(err));
    }
  },

  "whatsapp-meta": async (f) => {
    const phoneId = (f.phone_number_id ?? "").trim();
    const token = (f.access_token ?? "").trim();
    if (!phoneId || !token) return OK;
    try {
      const res = await fetchWithTimeout(
        `https://graph.facebook.com/v22.0/${encodeURIComponent(phoneId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        const field = res.status === 404 ? "phone_number_id" : "access_token";
        return fail(
          "handshake",
          field,
          `Meta Graph API returned HTTP ${res.status}. The token may be expired or missing whatsapp_business_messaging permission.`,
        );
      }
      return OK;
    } catch (err) {
      return fail("handshake", "access_token", describeFetchError(err));
    }
  },

  "azure-devops": async (f) => {
    const org = (f.organization ?? "").trim();
    const project = (f.project ?? "").trim();
    const pat = (f.pat ?? "").trim();
    if (!org || !project || !pat) return OK;
    const basic = Buffer.from(`:${pat}`).toString("base64");
    try {
      const res = await fetchWithTimeout(
        `https://dev.azure.com/${encodeURIComponent(org)}/_apis/projects/${encodeURIComponent(project)}?api-version=7.0`,
        { headers: { Authorization: `Basic ${basic}` } },
      );
      if (!res.ok) {
        const field =
          res.status === 401 || res.status === 403
            ? "pat"
            : res.status === 404
              ? "project"
              : "organization";
        return fail(
          "handshake",
          field,
          `Azure DevOps returned HTTP ${res.status}. Check the organisation, project name, and that the PAT includes Work Items (Read & write).`,
        );
      }
      return OK;
    } catch (err) {
      return fail("handshake", "pat", describeFetchError(err));
    }
  },

  "mcp-endpoint": async (f) => {
    const url = (f.endpoint_url ?? "").trim();
    if (!url) return OK;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = (f.auth_token ?? "").trim();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const rpc = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "investuae-signals", version: "1.0" },
      },
    };
    try {
      const res = await fetchWithTimeout(url, {
        method: "POST",
        headers,
        body: JSON.stringify(rpc),
      });
      if (!res.ok) {
        return fail(
          "handshake",
          "endpoint_url",
          `MCP server returned HTTP ${res.status}. Confirm the server speaks streamable HTTP and is reachable from the public internet.`,
        );
      }
      const txt = await res.text();
      if (!/"jsonrpc"\s*:\s*"2\.0"/.test(txt)) {
        return fail(
          "handshake",
          "endpoint_url",
          "Endpoint responded, but the body is not a JSON-RPC 2.0 reply.",
        );
      }
      return OK;
    } catch (err) {
      return fail("handshake", "endpoint_url", describeFetchError(err));
    }
  },
};

// ─────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────

export interface ValidateOptions {
  /** True when the user is updating an existing row; lets us skip the
   * handshake when no plaintext secrets were provided. */
  isUpdate?: boolean;
}

export async function validateConnector(
  connectorId: string,
  fields: Record<string, string>,
  opts: ValidateOptions = {},
): Promise<ValidationResult> {
  const spec = getConnector(connectorId);
  if (!spec) {
    return fail("shape", "connectorId", "Unknown connector.");
  }

  // Shape first — cheap and offline.
  const shape = SHAPE[connectorId];
  if (shape) {
    const res = shape(fields);
    if (!res.ok) return res;
  }

  // Handshake only if we have at least one secret in plaintext. On
  // updates where the user left secret fields blank, we have nothing
  // new to probe with; skip.
  const secretFieldNames = spec.fields.filter((f) => f.secret).map((f) => f.name);
  const hasAnySecret = secretFieldNames.some(
    (name) => (fields[name] ?? "").trim().length > 0,
  );
  if (opts.isUpdate && !hasAnySecret) return OK;

  const handshake = HANDSHAKE[connectorId];
  if (!handshake) return OK;
  return handshake(fields);
}

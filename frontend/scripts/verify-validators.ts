// Smoke test for the connector validators. Run with:
//   npx tsx scripts/verify-validators.ts
//
// Imports the real module. Shape checks run offline; we avoid cases
// that would trigger the live handshake so this never hits a vendor.

import { validateConnector } from "../lib/connections/validators";

interface Case {
  label: string;
  connectorId: string;
  fields: Record<string, string>;
  expect?: { ok: false; stage: "shape" | "handshake"; field: string };
}

const cases: Case[] = [
  // ── Shape-fail: the exact bug the user reported ─────────────────
  {
    label: "google-sheets-webhook rejects metaforgeportal.com",
    connectorId: "google-sheets-webhook",
    fields: { webhook_url: "https://metaforgeportal.com/" },
    expect: { ok: false, stage: "shape", field: "webhook_url" },
  },
  {
    label: "slack-webhook rejects metaforgeportal.com",
    connectorId: "slack-webhook",
    fields: { webhook_url: "https://metaforgeportal.com/" },
    expect: { ok: false, stage: "shape", field: "webhook_url" },
  },
  {
    label: "power-bi rejects random HTTPS URL",
    connectorId: "power-bi",
    fields: { push_url: "https://example.com/post" },
    expect: { ok: false, stage: "shape", field: "push_url" },
  },
  {
    label: "zapier rejects non-hooks.zapier.com URL",
    connectorId: "zapier",
    fields: { webhook_url: "https://attacker.example.com/catch" },
    expect: { ok: false, stage: "shape", field: "webhook_url" },
  },
  {
    label: "teams-webhook rejects metaforge URL",
    connectorId: "teams-webhook",
    fields: { webhook_url: "https://metaforgeportal.com/webhookb2/abc" },
    expect: { ok: false, stage: "shape", field: "webhook_url" },
  },
  {
    label: "email-resend rejects keys without re_ prefix",
    connectorId: "email-resend",
    fields: { api_key: "sk_notresend_123", from: "a@b.com", to: "x@y.com" },
    expect: { ok: false, stage: "shape", field: "api_key" },
  },
  {
    label: "notion-api rejects non-secret_ tokens",
    connectorId: "notion-api",
    fields: { api_key: "nottoken_abc", database_id: "a1b2c3d4e5f67890a1b2c3d4e5f67890" },
    expect: { ok: false, stage: "shape", field: "api_key" },
  },
  {
    label: "airtable rejects malformed base id",
    connectorId: "airtable",
    fields: { api_key: "patValidLookingToken", base_id: "notabase" },
    expect: { ok: false, stage: "shape", field: "base_id" },
  },
];

async function main() {
  let passed = 0;
  let failed = 0;

  for (const c of cases) {
    // For handshake-capable connectors we deliberately pass only
    // non-secret fields or malformed shapes — shape layer must fire first.
    const res = await validateConnector(c.connectorId, c.fields);
    let ok = true;
    if (c.expect) {
      if (res.ok !== c.expect.ok) ok = false;
      if (!res.ok && c.expect.stage && res.stage !== c.expect.stage) ok = false;
      if (!res.ok && c.expect.field && res.field !== c.expect.field) ok = false;
    }
    if (ok) {
      passed++;
      console.log(`  ok  ${c.label}`);
    } else {
      failed++;
      console.log(`FAIL  ${c.label}`);
      console.log(`      got: ${JSON.stringify(res)}`);
      console.log(`      expected: ${JSON.stringify(c.expect)}`);
    }
  }

  console.log(`\n${passed}/${passed + failed} passed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();

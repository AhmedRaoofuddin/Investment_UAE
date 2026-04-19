// Save a paste-based connector for the signed-in tenant.
//
// Accepts: { connectorId, fields: Record<string, string> }
// - `fields` is split into secret and public config based on the catalogue
//   spec. Secret fields are sealed per-tenant with AES-256-GCM before
//   being written to `ConnectionSecret`. Non-secret fields live on
//   `Connection.config` for read-back in the UI.
// - `connectorId` must resolve to an entry in CONNECTORS; unknown ids are
//   rejected with 400 to guard against spoofed providers.
// - We do NOT verify the webhook URL / API key here — providers differ
//   too wildly (GET vs POST, Slack's challenge/response, etc.). The
//   first pipeline dispatch is the real validation; failures surface as
//   `Connection.lastError` and `status = ERROR` on the row.
//
// All writes are audited via `audit({action:"connector.saved"})`.

import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { db, isDbConfigured } from "@/lib/db";
import { getConnector } from "@/lib/connections/catalogue";
import { sealSecret } from "@/lib/security/encryption";
import { requireSession } from "@/lib/security/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SaveBody {
  connectorId: string;
  fields: Record<string, string>;
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!isDbConfigured) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  let body: SaveBody;
  try {
    body = (await request.json()) as SaveBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body?.connectorId || typeof body.connectorId !== "string") {
    return NextResponse.json({ error: "missing_connector_id" }, { status: 400 });
  }
  const spec = getConnector(body.connectorId);
  if (!spec) {
    return NextResponse.json({ error: "unknown_connector" }, { status: 400 });
  }
  if (!spec.ready) {
    return NextResponse.json({ error: "connector_not_ready" }, { status: 400 });
  }

  // Validate required fields.
  const missing = spec.fields
    .filter((f) => f.required && !body.fields?.[f.name])
    .map((f) => f.name);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: "missing_required_fields", fields: missing },
      { status: 400 },
    );
  }

  // Split into secret + public config.
  const publicConfig: Record<string, string> = {};
  const secretFields: Array<{ name: string; value: string }> = [];
  for (const field of spec.fields) {
    const value = (body.fields[field.name] ?? "").trim();
    if (!value) continue;
    if (field.secret) {
      secretFields.push({ name: field.name, value });
    } else {
      publicConfig[field.name] = value;
    }
  }

  // Upsert the connection row first.
  const conn = await db().connection.upsert({
    where: {
      tenantId_provider: {
        tenantId: session.tenantId,
        provider: spec.id,
      },
    },
    create: {
      tenantId: session.tenantId,
      provider: spec.id,
      kind: spec.direction === "outbound" ? "API_KEY" : "API_KEY",
      status: "ACTIVE",
      label: spec.name,
      config: publicConfig as object,
    },
    update: {
      status: "ACTIVE",
      lastError: null,
      label: spec.name,
      config: publicConfig as object,
      updatedAt: new Date(),
    },
  });

  // Persist each secret field under its own `ConnectionSecret` row
  // keyed by `kind = field_name`. This lets us rotate individual fields
  // later (e.g. new Slack webhook URL) without nuking siblings.
  for (const { name, value } of secretFields) {
    const sealed = sealSecret(session.tenantId, value);
    await db().connectionSecret.upsert({
      where: { connectionId_kind: { connectionId: conn.id, kind: name } },
      create: {
        connectionId: conn.id,
        kind: name,
        ciphertext: new Uint8Array(sealed.ciphertext),
        iv: new Uint8Array(sealed.iv),
        authTag: new Uint8Array(sealed.authTag),
      },
      update: {
        ciphertext: new Uint8Array(sealed.ciphertext),
        iv: new Uint8Array(sealed.iv),
        authTag: new Uint8Array(sealed.authTag),
        updatedAt: new Date(),
      },
    });
  }

  audit({
    action: "connector.saved",
    tenantId: session.tenantId,
    userId: session.userId,
    subject: conn.id,
    meta: {
      connectorId: spec.id,
      hasSecrets: secretFields.length > 0,
    },
  });

  return NextResponse.json({ ok: true, connectionId: conn.id });
}

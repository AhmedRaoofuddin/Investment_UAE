// Workspace signal ingest endpoint.
//
// Called by the backend FastAPI pipeline after every refresh. The backend
// signs each request with WORKSPACE_INGEST_KEY (HMAC SHA-256 of the body)
// so we know it is genuinely from us and not a spammer.
//
// For each incoming signal, we run it against EVERY tenant's watchlist
// and create one notification per tenant per matched item. (The pilot
// has one tenant, so this is cheap. When we have many tenants we move
// to a per-tenant fanout queue.)
//
// Idempotency: signal_id + tenantId must be unique. We use a hash of
// (signal_id|tenantId) as the notification source key and skip dupes.

import { NextResponse, type NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db, isDbConfigured } from "@/lib/db";
import { matchSignalToWatchlist, severityFromStrength, type IncomingSignal } from "@/lib/notifications/matchWatchlist";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface IngestPayload {
  signals: IncomingSignal[];
  source: string;
  generated_at: string;
}

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.WORKSPACE_INGEST_KEY;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  if (expected.length !== signature.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!isDbConfigured) {
    return NextResponse.json({ error: "db-not-configured" }, { status: 503 });
  }
  const raw = await req.text();
  const sig = req.headers.get("x-ingest-signature");
  if (!verifySignature(raw, sig)) {
    return NextResponse.json({ error: "invalid-signature" }, { status: 401 });
  }
  let payload: IngestPayload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }
  if (!Array.isArray(payload.signals)) {
    return NextResponse.json({ error: "missing-signals" }, { status: 400 });
  }

  // Pull tenants + their watchlists once.
  const tenants = await db().tenant.findMany({
    select: { id: true, watchlist: true },
  });

  let created = 0;
  let skippedDupe = 0;

  for (const signal of payload.signals) {
    for (const tenant of tenants) {
      const matched = matchSignalToWatchlist(signal, tenant.watchlist);
      if (matched.length === 0) continue;

      const sourceId = `${signal.signal_id}:${tenant.id}`;
      const exists = await db().notification.findFirst({
        where: { tenantId: tenant.id, sourceKind: "signal", sourceId },
        select: { id: true },
      });
      if (exists) {
        skippedDupe++;
        continue;
      }

      const matchLabels = matched.map((m) => m.label).join(", ");
      await db().notification.create({
        data: {
          tenantId: tenant.id,
          severity: severityFromStrength(signal.strength),
          title: signal.headline,
          body:
            `${signal.rationale}\n\n` +
            `Matched watchlist: ${matchLabels}\n` +
            `Source: ${signal.source_name ?? "unknown"} ${signal.source_url ? `(${signal.source_url})` : ""}`,
          sourceKind: "signal",
          sourceId,
          deliveries: [{ channel: "in-app", ok: true, deliveredAt: new Date().toISOString() }] as object,
        },
      });
      created++;

      audit({
        action: "notification.sent",
        tenantId: tenant.id,
        subject: signal.signal_id,
        meta: {
          via: "ingest",
          source: payload.source,
          watchlistMatches: matched.map((m) => ({ kind: m.kind, value: m.value })),
        },
      });
    }
  }

  return NextResponse.json({ ok: true, created, skippedDupe, signals: payload.signals.length, tenants: tenants.length });
}

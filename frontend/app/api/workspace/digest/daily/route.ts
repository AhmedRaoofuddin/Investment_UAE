// Daily-digest cron handler.
//
// Called by the Vercel cron at 07:00 UTC. For every active tenant it
// fetches the latest high-conviction companies from the backend /api/digest
// endpoint, then creates one Notification per tenant. The notification
// service picks up the notification and fans it out through every
// connected channel (Slack webhook, Teams webhook, Resend email,
// WhatsApp Cloud, Custom Webhook, in-app inbox).
//
// Protected by a shared secret so only Vercel's cron runner can invoke it.
// Fails soft: a single tenant-level error is logged and skipped; the job
// completes for every other tenant.

import { NextRequest, NextResponse } from "next/server";
import { db, isDbConfigured } from "@/lib/db";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BACKEND_URL =
  process.env.BACKEND_URL ?? "https://backend-lyart-three-63.vercel.app";

interface DigestCompany {
  id: string;
  name: string;
  investability_score: number;
  uae_alignment_score: number;
  signals: Array<{
    id: string;
    type: string;
    strength: string;
    headline: string;
    source: { url: string; source_name: string };
  }>;
}

function formatBody(companies: DigestCompany[]): string {
  if (!companies.length) {
    return "No new high-conviction signals in the last 24 hours. The pipeline is quiet.";
  }
  const lines: string[] = [
    `Top ${companies.length} companies with fresh signals in the last 24 hours.`,
    "",
  ];
  for (const c of companies) {
    const score = Math.round((c.investability_score + c.uae_alignment_score) / 2);
    lines.push(`${c.name} (score ${score})`);
    for (const s of c.signals.slice(0, 3)) {
      lines.push(`  · ${s.type.toUpperCase()} / ${s.strength}: ${s.headline}`);
      lines.push(`    ${s.source.source_name} — ${s.source.url}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export async function GET(req: NextRequest) {
  // Gate on the Vercel cron secret so the route is not publicly callable
  const authHeader = req.headers.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET;
  if (expected && authHeader !== `Bearer ${expected}`) {
    return new NextResponse("unauthorised", { status: 401 });
  }

  if (!isDbConfigured) {
    return NextResponse.json({
      ok: false,
      reason: "db_not_configured",
    });
  }

  // Fetch the digest from the backend
  let companies: DigestCompany[] = [];
  try {
    const res = await fetch(`${BACKEND_URL}/api/digest?limit=10&window_hours=24`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`digest fetch failed: ${res.status}`);
    const payload = await res.json();
    companies = payload.items ?? [];
  } catch (err) {
    console.error("daily_digest_fetch_failed", err);
    return NextResponse.json({ ok: false, reason: "backend_unreachable" });
  }

  const title =
    companies.length > 0
      ? `Daily digest: ${companies.length} new high-conviction signals`
      : "Daily digest: pipeline quiet today";
  const body = formatBody(companies);
  const severity = companies.length > 0 ? "ALERT" : "INFO";

  // Create one notification per active tenant
  const tenants = await db().tenant.findMany({
    select: { id: true },
  });

  let created = 0;
  for (const t of tenants) {
    try {
      await db().notification.create({
        data: {
          tenantId: t.id,
          severity: severity as "ALERT" | "INFO",
          status: "UNREAD",
          title,
          body,
          sourceKind: "daily-digest",
          sourceId: null,
        },
      });
      created += 1;
    } catch (err) {
      console.error(`daily_digest_tenant_${t.id}_failed`, err);
    }
  }

  await audit({
    action: "daily_digest.created",
    subject: "cron",
    meta: { tenants_notified: created, companies_surfaced: companies.length },
  });

  return NextResponse.json({
    ok: true,
    tenants_notified: created,
    companies_surfaced: companies.length,
  });
}

// Live data feed for the immersive Pulse view.
//
// Returns: geo points (filtered to watchlist when present, all top-scoring
// otherwise), the freshest 12 notifications, the freshest 8 signals
// flattened across the company list, and per-tenant counters.
//
// Polled every 30s from the client. Aggressively cached on the server
// (5s) so a tab left open doesn't hammer the DB.

import { NextResponse } from "next/server";
import { db, isDbConfigured } from "@/lib/db";
import { getSessionOrNull } from "@/lib/security/session";
import { matchSignalToWatchlist, type IncomingSignal } from "@/lib/notifications/matchWatchlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Match the dashboard route: bump above the default 10s so a cold
// backend pipeline run (20-25s) doesn't kill the function silently.
export const maxDuration = 30;

const BACKEND = process.env.BACKEND_URL ?? "https://backend-lyart-three-63.vercel.app";
const BACKEND_FETCH_TIMEOUT_MS = 25_000;

interface BackendCompany {
  id: string;
  name: string;
  aliases?: string[];
  sectors?: string[];
  headquarters?: { country?: string; country_code?: string; city?: string; lat?: number; lng?: number };
  expansion_targets?: { country?: string; country_code?: string; city?: string; lat?: number; lng?: number }[];
  investability_score?: number;
  uae_alignment_score?: number;
  signals: Array<{
    id: string;
    type: string;
    strength: "high" | "medium" | "low";
    headline: string;
    rationale: string;
    detected_at: string;
    source: { url?: string; source_name?: string; image_url?: string };
  }>;
}

interface BackendCompaniesResponse {
  generated_at: string;
  total: number;
  items: BackendCompany[];
}

export interface PulsePoint {
  id: string;
  companyId: string;
  companyName: string;
  lat: number;
  lng: number;
  score: number;
  intent: "headquarters" | "expansion_target";
  sectors: string[];
  matched: boolean;
  matchedBy?: string[];
  topSignal?: { type: string; strength: string; headline: string };
  // Number of signals reported for this company. Used by the map to
  // scatter smaller signal-dots around the HQ marker so the visual
  // density reflects how many news items we have, not just how many
  // distinct companies with coordinates.
  signalCount?: number;
}

export interface PulseSignal {
  signalId: string;
  companyId: string;
  companyName: string;
  type: string;
  strength: "high" | "medium" | "low";
  headline: string;
  rationale: string;
  sourceName?: string;
  sourceUrl?: string;
  sourceImageUrl?: string;
  detectedAt: string;
  matched: boolean;
  matchedBy?: string[];
}

export interface PulseNotification {
  id: string;
  severity: "INFO" | "ALERT" | "CRITICAL";
  status: "UNREAD" | "READ" | "ARCHIVED";
  title: string;
  body: string;
  createdAt: string;
}

export interface PulseResponse {
  generatedAt: string;
  pipelineGeneratedAt: string | null;
  watchlistCount: number;
  unreadCount: number;
  matchedSignalsCount: number;
  totalSignalsCount: number;
  topSectorsCounts: { sector: string; count: number }[];
  points: PulsePoint[];
  signals: PulseSignal[];
  notifications: PulseNotification[];
}

export async function GET() {
  const session = await getSessionOrNull();
  if (!session) return NextResponse.json({ error: "unauth" }, { status: 401 });
  if (!isDbConfigured) return NextResponse.json({ error: "db" }, { status: 503 });

  // Pull watchlist + notifications in parallel.
  const [watchlist, notifications, unreadCount] = await Promise.all([
    db().watchlistItem.findMany({ where: { tenantId: session.tenantId } }),
    db().notification.findMany({
      where: { tenantId: session.tenantId, status: { in: ["UNREAD" as const, "READ" as const] } },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, severity: true, status: true, title: true, body: true, createdAt: true },
    }),
    db().notification.count({
      where: { tenantId: session.tenantId, status: "UNREAD" },
    }),
  ]);

  // Pull live signals from the backend. Bounded + logged so a stalled
  // upstream shows up in Vercel logs instead of manifesting as "map with
  // no dots" in the UI with no explanation.
  let pipelineGeneratedAt: string | null = null;
  let companies: BackendCompany[] = [];
  try {
    const r = await fetch(`${BACKEND}/api/companies?limit=200`, {
      next: { revalidate: 5 },
      signal: AbortSignal.timeout(BACKEND_FETCH_TIMEOUT_MS),
    });
    if (r.ok) {
      const json = (await r.json()) as BackendCompaniesResponse;
      companies = json.items ?? [];
      pipelineGeneratedAt = json.generated_at ?? null;
    } else {
      console.error(
        `[workspace/pulse] backend /api/companies returned ${r.status} ${r.statusText}`,
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[workspace/pulse] backend fetch failed: ${msg}`);
    // Pulse still renders with watchlist + notifications from Postgres;
    // the empty-signals hint in PulseView covers the degraded state.
  }

  // Build geo points and flat signal list.
  const points: PulsePoint[] = [];
  const allSignals: PulseSignal[] = [];
  const sectorTally = new Map<string, number>();

  for (const c of companies) {
    const score = Math.round(
      ((c.investability_score ?? 0) + (c.uae_alignment_score ?? 0)) / 2,
    );
    const incomingBase: Omit<IncomingSignal, "signal_id" | "signal_type" | "strength" | "headline" | "rationale" | "source_url" | "source_name" | "detected_at"> = {
      company_id: c.id,
      company_name: c.name,
      company_aliases: c.aliases ?? [],
      sectors: c.sectors ?? [],
      hq_country_code: c.headquarters?.country_code ?? null,
      expansion_country_codes: (c.expansion_targets ?? [])
        .map((t) => t.country_code)
        .filter((x): x is string => Boolean(x)),
    };

    // Per-company top signal for the marker tooltip.
    const topSignal = c.signals[0]
      ? { type: c.signals[0].type, strength: c.signals[0].strength, headline: c.signals[0].headline }
      : undefined;

    // Pull all signals into the global list with watchlist match flags.
    for (const s of c.signals) {
      const inc: IncomingSignal = {
        ...incomingBase,
        signal_id: s.id,
        signal_type: s.type,
        strength: s.strength,
        headline: s.headline,
        rationale: s.rationale,
        source_url: s.source?.url,
        source_name: s.source?.source_name,
        detected_at: s.detected_at,
      };
      const matches = matchSignalToWatchlist(inc, watchlist);
      allSignals.push({
        signalId: s.id,
        companyId: c.id,
        companyName: c.name,
        type: s.type,
        strength: s.strength,
        headline: s.headline,
        rationale: s.rationale,
        sourceName: s.source?.source_name,
        sourceUrl: s.source?.url,
        sourceImageUrl: s.source?.image_url,
        detectedAt: s.detected_at,
        matched: matches.length > 0,
        matchedBy: matches.length > 0 ? matches.map((m) => m.label) : undefined,
      });
    }

    for (const sec of c.sectors ?? []) {
      sectorTally.set(sec, (sectorTally.get(sec) ?? 0) + 1);
    }

    // Geo points: HQ
    if (c.headquarters?.lat != null && c.headquarters?.lng != null) {
      const matches = matchSignalToWatchlist(
        {
          ...incomingBase,
          signal_id: `hq-${c.id}`,
          signal_type: "headquarters",
          strength: "low",
          headline: c.name,
          rationale: "",
          detected_at: "",
        },
        watchlist,
      );
      points.push({
        id: `hq-${c.id}`,
        companyId: c.id,
        companyName: c.name,
        lat: c.headquarters.lat,
        lng: c.headquarters.lng,
        score,
        intent: "headquarters",
        sectors: c.sectors ?? [],
        matched: matches.length > 0,
        matchedBy: matches.length > 0 ? matches.map((m) => m.label) : undefined,
        topSignal,
        signalCount: c.signals.length,
      });
    }
    // Geo points: expansion targets
    for (const t of c.expansion_targets ?? []) {
      if (t.lat != null && t.lng != null) {
        points.push({
          id: `exp-${c.id}-${t.country_code ?? t.city ?? Math.random()}`,
          companyId: c.id,
          companyName: c.name,
          lat: t.lat,
          lng: t.lng,
          score,
          intent: "expansion_target",
          sectors: c.sectors ?? [],
          matched: false,
          topSignal,
        });
      }
    }
  }

  // Sort signals: matched first (severity desc), then everything else by date desc.
  allSignals.sort((a, b) => {
    if (a.matched !== b.matched) return a.matched ? -1 : 1;
    const sa = a.strength === "high" ? 3 : a.strength === "medium" ? 2 : 1;
    const sb = b.strength === "high" ? 3 : b.strength === "medium" ? 2 : 1;
    if (sa !== sb) return sb - sa;
    return (b.detectedAt ?? "").localeCompare(a.detectedAt ?? "");
  });
  const trimmedSignals = allSignals.slice(0, 30);
  const matchedSignalsCount = allSignals.filter((s) => s.matched).length;

  const topSectors = Array.from(sectorTally.entries())
    .map(([sector, count]) => ({ sector, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const payload: PulseResponse = {
    generatedAt: new Date().toISOString(),
    pipelineGeneratedAt,
    watchlistCount: watchlist.length,
    unreadCount,
    matchedSignalsCount,
    totalSignalsCount: allSignals.length,
    topSectorsCounts: topSectors,
    points,
    signals: trimmedSignals,
    notifications: notifications.map((n) => ({
      id: n.id,
      severity: n.severity,
      status: n.status,
      title: n.title,
      body: n.body,
      createdAt: n.createdAt.toISOString(),
    })),
  };
  return NextResponse.json(payload);
}

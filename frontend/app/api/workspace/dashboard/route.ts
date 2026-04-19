// Aggregated analytics for the /workspace/dashboard view.
//
// Pulls the live pipeline snapshot + the tenant's watchlist and computes
// everything the dashboard renders: KPI tiles, 30-day trend, signal-type
// breakdown, top companies by composite score, top sectors, top source
// publishers, and a regional distribution.
//
// All aggregation happens here on the server so the client-side bundle
// stays small and the SWR-polled JSON payload is tight (~5-10 KB). No
// external analytics vendor is involved — the Ministry keeps 100% of
// the data within our stack.

import { NextResponse } from "next/server";
import { db, isDbConfigured } from "@/lib/db";
import { getSessionOrNull } from "@/lib/security/session";
import { matchSignalToWatchlist, type IncomingSignal } from "@/lib/notifications/matchWatchlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Bump the Vercel serverless function timeout. The backend's own pipeline
// run can take 20-25s from a cold cache; with the default 10s we time out
// before the upstream even responds, leaving the UI with silent zeros.
export const maxDuration = 30;

const BACKEND = process.env.BACKEND_URL ?? "https://backend-lyart-three-63.vercel.app";

// Explicit fetch timeout — slightly under `maxDuration` so we always return
// a structured error payload rather than Vercel killing the function.
const BACKEND_FETCH_TIMEOUT_MS = 25_000;

interface BackendCompany {
  id: string;
  name: string;
  aliases?: string[];
  sectors?: string[];
  headquarters?: { country?: string; country_code?: string; city?: string; lat?: number; lng?: number };
  expansion_targets?: { country?: string; country_code?: string; city?: string }[];
  investability_score?: number;
  uae_alignment_score?: number;
  signals: Array<{
    id: string;
    type: string;
    strength: "high" | "medium" | "low";
    headline: string;
    rationale: string;
    detected_at: string;
    source?: { url?: string; source_name?: string; image_url?: string };
  }>;
}

export interface DashboardResponse {
  generatedAt: string;
  pipelineGeneratedAt: string | null;
  /**
   * True when the live pipeline backend responded successfully. When false
   * the dashboard view surfaces a proper error banner with retry instead
   * of rendering an empty chart grid that looks like "no data".
   */
  backendReachable: boolean;
  /**
   * Machine-readable reason the backend fetch failed. Useful for the
   * error banner to give the user an actionable message ("timeout" vs
   * "502" vs "network error") rather than a generic "unavailable".
   */
  backendError: string | null;
  kpis: {
    totalSignals: number;
    matchedSignals: number;
    totalCompanies: number;
    avgScore: number;
    highStrengthPct: number;
    countriesCovered: number;
    publishersCovered: number;
    watchlistItems: number;
  };
  trend: Array<{ day: string; total: number; matched: number }>;
  typeBreakdown: Array<{ type: string; count: number }>;
  strengthBreakdown: Array<{ strength: string; count: number }>;
  topCompanies: Array<{
    id: string;
    name: string;
    score: number;
    investability: number;
    uaeAlignment: number;
    signalCount: number;
    sectors: string[];
    country: string | null;
  }>;
  topSectors: Array<{ sector: string; companyCount: number; signalCount: number; avgScore: number }>;
  topPublishers: Array<{ name: string; count: number }>;
  regions: Array<{ country: string; code: string | null; count: number }>;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const session = await getSessionOrNull();
  if (!session) return NextResponse.json({ error: "unauth" }, { status: 401 });

  // Pull tenant watchlist + pipeline snapshot in parallel.
  //
  // We bound the backend fetch explicitly so a stalled upstream never
  // blocks the whole function past `maxDuration`. On any failure we log
  // to stderr (Vercel surfaces this in the function logs) and fall
  // through to an empty `companies` list, but we mark `backendReachable`
  // false so the UI can render a proper error banner rather than zeros.
  //
  // limit=200 matches the backend's current cached_companies cap. Asking
  // for 500 pulled the same data with a larger wire envelope and
  // sometimes tripped Next.js data-cache size thresholds.
  let companies: BackendCompany[] = [];
  let pipelineGeneratedAt: string | null = null;
  let backendReachable = false;
  let backendError: string | null = null;

  const [watchlist] = await Promise.all([
    isDbConfigured
      ? db().watchlistItem.findMany({ where: { tenantId: session.tenantId } })
      : Promise.resolve([]),
    (async () => {
      try {
        const resp = await fetch(`${BACKEND}/api/companies?limit=200`, {
          next: { revalidate: 30 },
          signal: AbortSignal.timeout(BACKEND_FETCH_TIMEOUT_MS),
        });
        if (!resp.ok) {
          backendError = `upstream_${resp.status}`;
          console.error(
            `[workspace/dashboard] backend /api/companies returned ${resp.status} ${resp.statusText}`,
          );
          return;
        }
        const json = (await resp.json()) as {
          items?: BackendCompany[];
          generated_at?: string;
        };
        companies = json.items ?? [];
        pipelineGeneratedAt = json.generated_at ?? null;
        backendReachable = true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        backendError = msg.includes("timeout") || msg.includes("aborted") ? "timeout" : "network";
        console.error(`[workspace/dashboard] backend fetch failed (${backendError}): ${msg}`);
      }
    })(),
  ]);

  // Flatten signals, counting per company.
  type FlatSignal = BackendCompany["signals"][number] & {
    companyId: string;
    companyName: string;
    sectors: string[];
    matched: boolean;
  };
  const allSignals: FlatSignal[] = [];

  for (const c of companies) {
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
        ...s,
        companyId: c.id,
        companyName: c.name,
        sectors: c.sectors ?? [],
        matched: matches.length > 0,
      });
    }
  }

  // ── KPIs ──────────────────────────────────────────────────────────
  const matchedCount = allSignals.filter((s) => s.matched).length;
  const highCount = allSignals.filter((s) => s.strength === "high").length;
  const scoreSum = companies.reduce(
    (acc, c) => acc + ((c.investability_score ?? 0) + (c.uae_alignment_score ?? 0)) / 2,
    0,
  );
  const countries = new Set<string>();
  for (const c of companies) {
    if (c.headquarters?.country) countries.add(c.headquarters.country);
  }
  const publishers = new Set<string>();
  for (const s of allSignals) {
    if (s.source?.source_name) publishers.add(s.source.source_name);
  }

  // ── 30-day trend ──────────────────────────────────────────────────
  const trendMap = new Map<string, { total: number; matched: number }>();
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    trendMap.set(dayKey(d), { total: 0, matched: 0 });
  }
  for (const s of allSignals) {
    if (!s.detected_at) continue;
    const d = new Date(s.detected_at);
    if (Number.isNaN(d.getTime())) continue;
    const key = dayKey(d);
    const bucket = trendMap.get(key);
    if (bucket) {
      bucket.total += 1;
      if (s.matched) bucket.matched += 1;
    }
  }
  const trend = Array.from(trendMap.entries()).map(([day, v]) => ({
    day,
    total: v.total,
    matched: v.matched,
  }));

  // ── Type breakdown ────────────────────────────────────────────────
  const typeMap = new Map<string, number>();
  const strengthMap = new Map<string, number>();
  for (const s of allSignals) {
    typeMap.set(s.type, (typeMap.get(s.type) ?? 0) + 1);
    strengthMap.set(s.strength, (strengthMap.get(s.strength) ?? 0) + 1);
  }
  const typeBreakdown = Array.from(typeMap.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
  const strengthBreakdown = Array.from(strengthMap.entries()).map(([strength, count]) => ({
    strength,
    count,
  }));

  // ── Top companies ─────────────────────────────────────────────────
  const topCompanies = [...companies]
    .map((c) => ({
      id: c.id,
      name: c.name,
      score: ((c.investability_score ?? 0) + (c.uae_alignment_score ?? 0)) / 2,
      investability: c.investability_score ?? 0,
      uaeAlignment: c.uae_alignment_score ?? 0,
      signalCount: c.signals.length,
      sectors: c.sectors ?? [],
      country: c.headquarters?.country ?? null,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  // ── Top sectors ───────────────────────────────────────────────────
  const sectorAgg = new Map<string, { companies: Set<string>; signals: number; scores: number[] }>();
  for (const c of companies) {
    const score = ((c.investability_score ?? 0) + (c.uae_alignment_score ?? 0)) / 2;
    for (const sec of c.sectors ?? []) {
      const entry = sectorAgg.get(sec) ?? { companies: new Set(), signals: 0, scores: [] };
      entry.companies.add(c.id);
      entry.signals += c.signals.length;
      entry.scores.push(score);
      sectorAgg.set(sec, entry);
    }
  }
  const topSectors = Array.from(sectorAgg.entries())
    .map(([sector, v]) => ({
      sector,
      companyCount: v.companies.size,
      signalCount: v.signals,
      avgScore: v.scores.length > 0 ? v.scores.reduce((a, b) => a + b, 0) / v.scores.length : 0,
    }))
    .sort((a, b) => b.signalCount - a.signalCount)
    .slice(0, 10);

  // ── Top publishers ────────────────────────────────────────────────
  const pubMap = new Map<string, number>();
  for (const s of allSignals) {
    const name = s.source?.source_name ?? "Unknown";
    pubMap.set(name, (pubMap.get(name) ?? 0) + 1);
  }
  const topPublishers = Array.from(pubMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // ── Regions ───────────────────────────────────────────────────────
  const regionMap = new Map<string, { code: string | null; count: number }>();
  for (const c of companies) {
    if (!c.headquarters?.country) continue;
    const key = c.headquarters.country;
    const cur = regionMap.get(key) ?? { code: c.headquarters.country_code ?? null, count: 0 };
    cur.count += 1;
    regionMap.set(key, cur);
  }
  const regions = Array.from(regionMap.entries())
    .map(([country, v]) => ({ country, code: v.code, count: v.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const payload: DashboardResponse = {
    generatedAt: new Date().toISOString(),
    pipelineGeneratedAt,
    backendReachable,
    backendError,
    kpis: {
      totalSignals: allSignals.length,
      matchedSignals: matchedCount,
      totalCompanies: companies.length,
      avgScore: companies.length > 0 ? scoreSum / companies.length : 0,
      highStrengthPct: allSignals.length > 0 ? (highCount / allSignals.length) * 100 : 0,
      countriesCovered: countries.size,
      publishersCovered: publishers.size,
      watchlistItems: watchlist.length,
    },
    trend,
    typeBreakdown,
    strengthBreakdown,
    topCompanies,
    topSectors,
    topPublishers,
    regions,
  };

  return NextResponse.json(payload);
}

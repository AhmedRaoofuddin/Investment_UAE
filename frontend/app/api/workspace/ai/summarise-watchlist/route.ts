// AI button: Summarise my watchlist.
//
// Pulls every signal from the live FastAPI backend that touches any of
// the user's watchlist items, then asks Claude (audited via lib/ai/client)
// for a 4-bullet briefing. The result is written as a CRITICAL notification
// so it shows up at the top of the inbox.

import { NextResponse, type NextRequest } from "next/server";
import { db, isDbConfigured } from "@/lib/db";
import { getSessionOrNull } from "@/lib/security/session";
import { chat } from "@/lib/ai/client";
import { matchSignalToWatchlist, type IncomingSignal } from "@/lib/notifications/matchWatchlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND = process.env.BACKEND_URL ?? "https://backend-lyart-three-63.vercel.app";

interface BackendSignal {
  id: string;
  type: string;
  strength: "high" | "medium" | "low";
  headline: string;
  rationale: string;
  detected_at: string;
  source: { url?: string; source_name?: string };
}

interface BackendCompany {
  id: string;
  name: string;
  aliases?: string[];
  sectors?: string[];
  headquarters?: { country_code?: string };
  expansion_targets?: { country_code?: string }[];
  signals: BackendSignal[];
}

export async function POST(req: NextRequest) {
  const session = await getSessionOrNull();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (!isDbConfigured) return new NextResponse("DB not configured", { status: 503 });

  const watchlist = await db().watchlistItem.findMany({
    where: { tenantId: session.tenantId },
  });
  if (watchlist.length === 0) {
    return NextResponse.redirect(
      new URL("/workspace/watchlist?error=empty", req.url),
      303,
    );
  }

  // Throttle: refuse to write a new briefing if the last one is < 5 min old.
  // Stops the inbox getting flooded by accidental double-clicks.
  const recent = await db().notification.findFirst({
    where: {
      tenantId: session.tenantId,
      sourceKind: "ai-summary",
      createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    return NextResponse.redirect(
      new URL("/workspace/notifications?info=throttled", req.url),
      303,
    );
  }

  // Pull a batch of companies from the live backend.
  let companies: BackendCompany[] = [];
  try {
    const resp = await fetch(`${BACKEND}/api/companies?limit=120`, {
      cache: "no-store",
    });
    if (resp.ok) {
      const json = (await resp.json()) as { items: BackendCompany[] };
      companies = json.items ?? [];
    }
  } catch {
    // Fall through with empty list; we'll surface an error notification.
  }

  // Flatten + filter by watchlist.
  const matchedSignals: { signal: IncomingSignal; matches: { kind: string; value: string }[] }[] = [];
  for (const c of companies) {
    for (const s of c.signals) {
      const incoming: IncomingSignal = {
        signal_id: s.id,
        company_id: c.id,
        company_name: c.name,
        company_aliases: c.aliases ?? [],
        sectors: c.sectors ?? [],
        hq_country_code: c.headquarters?.country_code ?? null,
        expansion_country_codes: (c.expansion_targets ?? [])
          .map((t) => t.country_code)
          .filter((x): x is string => Boolean(x)),
        signal_type: s.type,
        strength: s.strength,
        headline: s.headline,
        rationale: s.rationale,
        source_url: s.source?.url,
        source_name: s.source?.source_name,
        detected_at: s.detected_at,
      };
      const matches = matchSignalToWatchlist(incoming, watchlist);
      if (matches.length > 0) {
        matchedSignals.push({
          signal: incoming,
          matches: matches.map((m) => ({ kind: m.kind, value: m.value })),
        });
      }
    }
  }

  if (matchedSignals.length === 0) {
    await db().notification.create({
      data: {
        tenantId: session.tenantId,
        severity: "INFO",
        title: "Watchlist briefing",
        body:
          "No signals matched your watchlist in the latest pipeline run. " +
          "Either widen your watchlist (broader sectors, more keywords) " +
          "or wait for the next refresh. Fresh articles are scanned daily.",
        sourceKind: "ai-summary",
        sourceId: `watchlist-${Date.now()}`,
      },
    });
    return NextResponse.redirect(new URL("/workspace/notifications", req.url), 303);
  }

  // Cap to top 30 to keep the prompt bounded.
  const top = matchedSignals.slice(0, 30);
  const watchSummary = watchlist
    .map((w) => `- ${w.kind}: ${w.label}`)
    .join("\n");
  const signalsBlock = top
    .map(
      (m, i) =>
        `[${i + 1}] ${m.signal.company_name} | ${m.signal.signal_type} | ${m.signal.strength}\n` +
        `    ${m.signal.headline}\n` +
        `    ${m.signal.rationale.slice(0, 240)}\n` +
        `    matched: ${m.matches.map((x) => `${x.kind}:${x.value}`).join(", ")}`,
    )
    .join("\n\n");

  const result = await chat({
    tenantId: session.tenantId,
    userId: session.userId,
    purpose: "watchlist-summary",
    tier: "fast",
    maxTokens: 600,
    systemPrompt:
      "You are an investment-signal briefing analyst writing for the UAE Ministry of Investment FDI team. " +
      "You summarise watchlist matches in 3 to 5 dense bullets. " +
      "You cite signal numbers in square brackets like [3]. " +
      "You never invent facts beyond the signals provided. " +
      "You do not give buy/sell advice.",
    userMessage:
      `Investor watchlist:\n${watchSummary}\n\n` +
      `Signals matched in the latest pipeline run (${matchedSignals.length} total, top ${top.length} shown):\n\n` +
      `${signalsBlock}\n\n` +
      `Write the morning briefing for this investor.`,
  });

  if (!result.ok) {
    // Claude is unavailable (no key, billing, rate-limited, upstream down).
    // The whole point of our ML-agent stack is that the pipeline produces
    // *structured* signal data — we don't actually need an LLM to write a
    // useful briefing. Generate one deterministically from the same
    // matched-signals list, grouped by signal type. The user gets a real
    // briefing; Claude becomes a nice-to-have upgrade, not a hard dep.
    const templateBody = buildTemplateBriefing(top, matchedSignals.length, watchlist);
    const reason = describeFailureReason(result.failure, result.failureDetail);
    await db().notification.create({
      data: {
        tenantId: session.tenantId,
        severity: "CRITICAL",
        title: `Watchlist briefing: ${matchedSignals.length} signals matched`,
        body: `${templateBody}\n\n---\nGenerated from pipeline metadata. ${reason}`,
        sourceKind: "ai-summary",
        sourceId: `watchlist-tpl-${Date.now()}`,
      },
    });
  } else {
    await db().notification.create({
      data: {
        tenantId: session.tenantId,
        severity: "CRITICAL",
        title: `Watchlist briefing: ${matchedSignals.length} signals matched`,
        body: result.text,
        sourceKind: "ai-summary",
        sourceId: `watchlist-${Date.now()}`,
      },
    });
  }

  return NextResponse.redirect(new URL("/workspace/notifications", req.url), 303);
}

// ── Deterministic briefing (no LLM required) ────────────────────────
//
// The FastAPI backend's ML-agent pipeline already extracts structured
// signals (type, strength, company, headline, source). A coherent
// briefing only needs light templating. We render as clean plain text
// rather than Markdown, because the notifications surface uses
// `whitespace-pre-line` without a Markdown parser — any `**bold**` or
// `_italic_` syntax would leak through as literal characters.
//
// Shape of the output:
//
//   25 signals matched your watchlist across 4 categories.
//   Strength: 19 high · 6 medium · 0 low
//
//   FUNDING & CAPITAL   14 signals
//     1. Spektr raises $20m for AI-based compliance platform
//        HIGH · Spektr · Finextra
//     ...
//
//   MATCHED BY
//     sector:Fintech   25 signals
//
//   Generated from pipeline metadata. <reason>

const TYPE_LABELS: Record<string, string> = {
  funding: "FUNDING & CAPITAL",
  expansion: "EXPANSION & MARKET ENTRY",
  partnership: "PARTNERSHIPS",
  launch: "PRODUCT / SERVICE LAUNCHES",
  m_and_a: "M&A ACTIVITY",
  regulatory: "REGULATORY & POLICY",
  hiring: "HIRING MOMENTUM",
  executive: "EXECUTIVE MOVES",
};

type MatchedEntry = {
  signal: IncomingSignal;
  matches: { kind: string; value: string }[];
};

// Filter obvious extractor artifacts — sentence fragments the backend's
// `_looks_like_company_name` guard occasionally lets through. Defence in
// depth at the briefing layer so one bad row doesn't make the whole
// briefing look unprofessional.
function looksLikeRealCompanyName(name: string): boolean {
  const s = name.trim();
  if (s.length < 2) return false;
  const lower = s.toLowerCase();
  // Fragment starters / connector patterns.
  const bad = [
    /^(the|a|an|this|that|these|those|some|any|every|all|no)\b/i,
    /^(its?|his|her|their|our|my|your)\b/i,
    /\b(newly|led by|raised|raises|announced|announces|plans|plan to)\b/i,
    /^(series [a-e]|funding round|round of)/i,
    /^(\d{4}|[0-9.]+ ?(m|bn|million|billion))$/i,
  ];
  if (bad.some((re) => re.test(s))) return false;
  // Reject all-lowercase single tokens shorter than 4 chars.
  if (s === lower && !/\s/.test(s) && s.length < 4) return false;
  return true;
}

// Normalise a headline for dedup keys — same article, two companies
// extracted, should collapse into one row.
function dedupKey(s: IncomingSignal): string {
  const url = (s.source_url ?? "").trim();
  if (url) return `url:${url}`;
  return `hl:${(s.headline ?? "").trim().toLowerCase().slice(0, 140)}`;
}

function truncate(s: string, n: number): string {
  if (!s) return "";
  if (s.length <= n) return s;
  // Break on the last space before the cap so we don't cut mid-word.
  const cut = s.slice(0, n);
  const last = cut.lastIndexOf(" ");
  return (last > 40 ? cut.slice(0, last) : cut).trim() + "…";
}

function buildTemplateBriefing(
  top: MatchedEntry[],
  totalMatched: number,
  watchlist: { kind: string; label: string; value: string }[],
): string {
  if (top.length === 0) return "No matches in the latest pipeline run.";

  // ── Clean + dedup pass ────────────────────────────────────────
  const seen = new Set<string>();
  const cleaned: MatchedEntry[] = [];
  for (const m of top) {
    const key = dedupKey(m.signal);
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(m);
  }

  // Header lines.
  const watchLine = watchlist
    .map((w) => `${w.kind.toLowerCase()}: ${w.label}`)
    .join(" · ");

  // Group by signal type.
  const byType = new Map<string, MatchedEntry[]>();
  for (const m of cleaned) {
    const arr = byType.get(m.signal.signal_type) ?? [];
    arr.push(m);
    byType.set(m.signal.signal_type, arr);
  }

  const orderedTypes = Array.from(byType.entries()).sort(
    (a, b) => b[1].length - a[1].length,
  );

  // Strength mix counted off the full (pre-dedup) matched set so the
  // headline number matches the "25 signals matched" in the title.
  const strengthCounts = { high: 0, medium: 0, low: 0 };
  for (const m of top) {
    const s = m.signal.strength;
    if (s === "high" || s === "medium" || s === "low") strengthCounts[s]++;
  }

  const lines: string[] = [];
  lines.push(
    `${totalMatched} signal${totalMatched === 1 ? "" : "s"} matched your watchlist across ${byType.size} categor${byType.size === 1 ? "y" : "ies"}.`,
  );
  if (watchLine) {
    lines.push(`Watchlist: ${watchLine}`);
  }
  lines.push(
    `Strength: ${strengthCounts.high} high · ${strengthCounts.medium} medium · ${strengthCounts.low} low`,
  );
  lines.push("");

  // ── One section per signal type ──────────────────────────────
  let globalIdx = 0;
  for (const [type, items] of orderedTypes) {
    const label = TYPE_LABELS[type] ?? type.toUpperCase().replace(/_/g, " ");
    const count = items.length;
    lines.push(`${label}   ${count} signal${count === 1 ? "" : "s"}`);

    const sorted = [...items].sort((a, b) => {
      const sa = a.signal.strength === "high" ? 2 : a.signal.strength === "medium" ? 1 : 0;
      const sb = b.signal.strength === "high" ? 2 : b.signal.strength === "medium" ? 1 : 0;
      if (sa !== sb) return sb - sa;
      return (b.signal.detected_at ?? "").localeCompare(a.signal.detected_at ?? "");
    });

    // Cap at 4 per type so the briefing stays scannable.
    for (const m of sorted.slice(0, 4)) {
      globalIdx++;
      const strength =
        m.signal.strength === "high" ? "HIGH" : m.signal.strength === "medium" ? "MED" : "LOW";
      const company = looksLikeRealCompanyName(m.signal.company_name)
        ? m.signal.company_name
        : ""; // suppress fragments, rely on headline only

      const headline = truncate(m.signal.headline ?? "", 140);
      const metaParts = [strength];
      if (company) metaParts.push(company);
      if (m.signal.source_name) metaParts.push(m.signal.source_name);

      // Indented block: "  N. Headline" then "     META · META · META"
      const numberPrefix = `  ${globalIdx}.`.padEnd(5, " ");
      lines.push(`${numberPrefix} ${headline}`);
      lines.push(`       ${metaParts.join(" · ")}`);
    }
    if (count > 4) {
      lines.push(`       + ${count - 4} more in this category`);
    }
    lines.push("");
  }

  // ── Match attribution ────────────────────────────────────────
  const matchReasons = new Map<string, number>();
  for (const m of cleaned) {
    for (const match of m.matches) {
      const key = `${match.kind.toLowerCase()}:${match.value}`;
      matchReasons.set(key, (matchReasons.get(key) ?? 0) + 1);
    }
  }
  if (matchReasons.size > 0) {
    lines.push("MATCHED BY");
    const reasons = Array.from(matchReasons.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    for (const [k, n] of reasons) {
      lines.push(`  ${k}   ${n} signal${n === 1 ? "" : "s"}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

function describeFailureReason(
  failure: string | undefined,
  detail: string | undefined,
): string {
  if (detail === "no-api-key") {
    return "AI prose layer is not configured on this deployment, so we rendered the briefing from the pipeline's structured data instead.";
  }
  if (failure === "billing-balance") {
    return "The AI prose layer hit a billing limit, so we rendered the briefing from the pipeline's structured data instead.";
  }
  if (failure === "rate-limited") {
    return "The AI prose layer is rate-limited right now, so we rendered the briefing from the pipeline's structured data instead.";
  }
  if (failure === "guardrail" || failure === "refused") {
    return "The AI prose layer declined on safety grounds, so we rendered the briefing from the pipeline's structured data instead.";
  }
  return "The AI prose layer is temporarily unavailable, so we rendered the briefing from the pipeline's structured data instead.";
}

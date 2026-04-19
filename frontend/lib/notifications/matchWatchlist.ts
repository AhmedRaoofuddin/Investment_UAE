// Watchlist matcher.
//
// Given a signal payload from the backend, return the watchlist items it
// matches for a given tenant. Empty array means no match (and no alert).
//
// Matching is intentionally simple for the pilot:
//   COMPANY  — value matches any of: company id, company name (lowercased
//              substring), or any aliases on the signal.
//   SECTOR   — value matches any sector on the signal.
//   REGION   — value matches headquarters country code OR any expansion
//              target country code.
//   KEYWORD  — value is a substring of headline OR rationale (case-insensitive).
//
// We also derive a severity from the signal strength so the UI can render
// it as INFO / ALERT / CRITICAL.

import type { WatchlistItem, NotificationSeverity } from "@prisma/client";

export interface IncomingSignal {
  // From the backend Signal model — only the fields we need.
  signal_id: string;
  company_id: string;
  company_name: string;
  company_aliases?: string[];
  sectors?: string[];
  hq_country_code?: string | null;
  expansion_country_codes?: string[];
  signal_type: string;
  strength: "high" | "medium" | "low";
  headline: string;
  rationale: string;
  source_url?: string;
  source_name?: string;
  detected_at: string;
}

export function severityFromStrength(s: IncomingSignal["strength"]): NotificationSeverity {
  if (s === "high") return "CRITICAL";
  if (s === "medium") return "ALERT";
  return "INFO";
}

export function matchSignalToWatchlist(
  signal: IncomingSignal,
  watchlist: WatchlistItem[],
): WatchlistItem[] {
  const matched: WatchlistItem[] = [];
  const haystackText =
    `${signal.headline} ${signal.rationale}`.toLowerCase();
  const compName = signal.company_name.toLowerCase();
  const aliases = (signal.company_aliases ?? []).map((a) => a.toLowerCase());

  for (const item of watchlist) {
    const v = item.value.toLowerCase();
    let hit = false;

    switch (item.kind) {
      case "COMPANY":
        hit =
          signal.company_id.toLowerCase().includes(v) ||
          compName.includes(v) ||
          aliases.some((a) => a.includes(v));
        break;
      case "SECTOR":
        hit = (signal.sectors ?? []).some(
          (s) => s.toLowerCase() === v,
        );
        break;
      case "REGION": {
        const regions = [signal.hq_country_code, ...(signal.expansion_country_codes ?? [])]
          .filter(Boolean)
          .map((r) => r!.toLowerCase());
        hit = regions.includes(v);
        break;
      }
      case "KEYWORD":
        hit = haystackText.includes(v);
        break;
    }
    if (hit) matched.push(item);
  }
  return matched;
}

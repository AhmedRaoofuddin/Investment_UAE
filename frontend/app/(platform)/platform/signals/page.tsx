"use client";

import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import { Activity, Filter } from "lucide-react";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { SignalCard } from "@/components/platform/SignalCard";
import { EmptyState } from "@/components/platform/EmptyState";
import { Badge } from "@/components/ui/primitives";
import { Pagination } from "@/components/ui/Pagination";
import { api } from "@/lib/api/client";
import type { Company, Signal, SignalStrength, SignalType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const TYPES: { value: SignalType | "all"; labelKey: string }[] = [
  { value: "all", labelKey: "platform.signals.type.all" },
  { value: "funding", labelKey: "platform.signals.type.funding" },
  { value: "expansion", labelKey: "platform.signals.type.expansion" },
  { value: "partnership", labelKey: "platform.signals.type.partnership" },
  { value: "launch", labelKey: "platform.signals.type.launch" },
  { value: "regulatory", labelKey: "platform.signals.type.regulatory" },
  { value: "hiring", labelKey: "platform.signals.type.hiring" },
  { value: "m_and_a", labelKey: "platform.signals.type.m_and_a" },
  { value: "executive", labelKey: "platform.signals.type.executive" },
];

const STRENGTHS: { value: SignalStrength | "all"; labelKey: string }[] = [
  { value: "all", labelKey: "platform.signals.strength.all" },
  { value: "high", labelKey: "platform.signals.strength.high" },
  { value: "medium", labelKey: "platform.signals.strength.medium" },
  { value: "low", labelKey: "platform.signals.strength.low" },
];

const PER_PAGE = 24;

interface FlatSignal extends Signal {
  companyId: string;
  companyName: string;
}

export default function SignalsPage() {
  const { t } = useLocale();
  const { data, error, isLoading } = useSWR(
    "companies-all",
    () => api.companies({ limit: 200 }),
    { refreshInterval: 60_000 },
  );

  const [type, setType] = useState<SignalType | "all">("all");
  const [strength, setStrength] = useState<SignalStrength | "all">("all");
  const [page, setPage] = useState(1);

  const signals = useMemo<FlatSignal[]>(() => {
    if (!data) return [];
    const flat: FlatSignal[] = [];
    for (const c of data.items as Company[]) {
      for (const s of c.signals) {
        flat.push({ ...s, companyId: c.id, companyName: c.name });
      }
    }

    // Collapse duplicate signals by source URL. The entity extractor can
    // surface the same article under multiple "companies" when it mis-tags
    // sentence fragments ("SERIES B TO", "THE ROUND WAS LED BY…") — which
    // used to render as N near-identical cards. Keep the first occurrence
    // by detection time; prefer the one whose company name looks real
    // (short, Title-Cased) over the phantom fragments.
    const byUrl = new Map<string, FlatSignal>();
    for (const s of flat) {
      const key = (s.source?.url || s.id).toLowerCase();
      const existing = byUrl.get(key);
      if (!existing) {
        byUrl.set(key, s);
      } else if (scoreCompanyName(s.companyName) > scoreCompanyName(existing.companyName)) {
        byUrl.set(key, s);
      }
    }

    return Array.from(byUrl.values())
      .filter((s) => (type === "all" ? true : s.type === type))
      .filter((s) => (strength === "all" ? true : s.strength === strength))
      .sort(
        (a, b) =>
          new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime(),
      );
  }, [data, type, strength]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [type, strength]);

  const totalPages = Math.max(1, Math.ceil(signals.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PER_PAGE;
  const pageEnd = pageStart + PER_PAGE;
  const paginatedSignals = signals.slice(pageStart, pageEnd);

  return (
    <PlatformShell
      title={t("platform.signals.title")}
      subtitle={t("platform.signals.subtitle")}
    >
      {/* Filters */}
      <div className="space-y-3 md:space-y-0 md:flex md:items-center md:gap-4 mb-6 md:mb-8 md:flex-wrap">
        <div className="inline-flex items-center gap-2 text-xs text-ink-500 uppercase tracking-[0.2em] font-medium shrink-0">
          <Filter className="w-3.5 h-3.5" /> {t("platform.signals.filter")}
        </div>

        <div className="flex items-center gap-1 bg-white border border-line rounded-[3px] p-1 overflow-x-auto scrollbar-hide">
          {TYPES.map((tp) => (
            <button
              key={tp.value}
              onClick={() => setType(tp.value)}
              className={cn(
                "px-2.5 md:px-3 py-1.5 text-xs font-medium rounded-[2px] whitespace-nowrap transition-colors",
                type === tp.value
                  ? "bg-navy-800 text-white"
                  : "text-ink-500 hover:text-navy-800",
              )}
            >
              {t(tp.labelKey)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-white border border-line rounded-[3px] p-1 overflow-x-auto scrollbar-hide">
          {STRENGTHS.map((s) => (
            <button
              key={s.value}
              onClick={() => setStrength(s.value)}
              className={cn(
                "px-2.5 md:px-3 py-1.5 text-xs font-medium rounded-[2px] whitespace-nowrap transition-colors",
                strength === s.value
                  ? "bg-navy-800 text-white"
                  : "text-ink-500 hover:text-navy-800",
              )}
            >
              {t(s.labelKey)}
            </button>
          ))}
        </div>

        <div className="md:ml-auto inline-flex items-center gap-2 text-xs text-ink-500">
          <span className="pulse-dot" /> {t("platform.signals.polling")} · {signals.length} {t("platform.signals.matches")}
        </div>
      </div>

      {error && (
        <EmptyState
          title={t("platform.signals.error.title")}
          body={t("platform.signals.error.body")}
        />
      )}

      {isLoading && !data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {data && signals.length === 0 && (
        <EmptyState
          title={t("platform.signals.empty.title")}
          body={t("platform.signals.empty.body")}
        />
      )}

      {data && signals.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginatedSignals.map((s) => (
              <SignalCard key={s.id} signal={s} companyName={s.companyName} />
            ))}
          </div>

          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageStart={pageStart}
              pageEnd={Math.min(pageEnd, signals.length)}
              totalItems={signals.length}
              itemNounKey="common.pagination.noun.signals"
              itemNounFallback="signals"
              onChange={(p) => {
                setPage(p);
                if (typeof window !== "undefined") {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
            />
          )}
        </>
      )}
    </PlatformShell>
  );
}

/**
 * Heuristic "does this look like a real company name" score.
 * Higher = more likely a real company. Used to pick the best display
 * name when the entity extractor generated multiple phantom "companies"
 * from the same article.
 *
 *  +3 short (≤ 4 words)
 *  +2 starts with a capital letter
 *  +2 contains no verb-like tokens ("secured", "raised", "announced", …)
 *  -5 contains obvious fragment markers ("the round", "series", "backed", …)
 *  -3 is all-lowercase or all-uppercase (CSV noise)
 */
function scoreCompanyName(name: string): number {
  if (!name) return -10;
  const trimmed = name.trim();
  let score = 0;
  const words = trimmed.split(/\s+/).filter(Boolean);

  if (words.length === 0) return -10;
  if (words.length <= 4) score += 3;
  if (words.length > 6) score -= 3;

  if (/^[A-Z]/.test(trimmed)) score += 2;
  if (trimmed === trimmed.toLowerCase()) score -= 3;
  if (trimmed === trimmed.toUpperCase() && trimmed.length > 4) score -= 2;

  const fragmentMarkers = [
    /\bthe round\b/i,
    /\bseries [A-Z]\b/i,
    /\bseries\s+[A-Z]\s+to\b/i,
    /\bled by\b/i,
    /\bparticipated\b/i,
    /\bsecured?\b/i,
    /\braised?\b/i,
    /\bannounced?\b/i,
    /\bbacked?\b/i,
    /\bpartners?\s+the\b/i,
  ];
  if (fragmentMarkers.some((re) => re.test(trimmed))) score -= 5;

  // Prefer names with no trailing article/preposition
  if (/\b(the|and|with|from|to|for|in|of|by)$/i.test(trimmed)) score -= 4;

  return score;
}

function SkeletonCard() {
  const { t } = useLocale();
  return (
    <div className="surface-card p-6 animate-pulse">
      <div className="flex items-center gap-2 mb-4">
        <Badge>{t("platform.signals.skeleton.loading")}</Badge>
        <span className="ml-auto h-3 w-12 bg-sand-200 rounded" />
      </div>
      <div className="h-5 w-3/4 bg-sand-200 rounded mb-3" />
      <div className="space-y-2">
        <div className="h-3 w-full bg-sand-100 rounded" />
        <div className="h-3 w-5/6 bg-sand-100 rounded" />
      </div>
    </div>
  );
}

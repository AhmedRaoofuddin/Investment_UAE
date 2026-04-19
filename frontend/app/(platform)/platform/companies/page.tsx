"use client";

import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown01,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { CompanyCard } from "@/components/platform/CompanyCard";
import { EmptyState } from "@/components/platform/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { api } from "@/lib/api/client";
import type { Sector } from "@/lib/types";
import { cn, sectorLabel } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const PER_PAGE = 24;

const SECTORS: { value: Sector | "all"; labelKey: string }[] = [
  { value: "all", labelKey: "platform.companies.sector.all" },
  { value: "fintech", labelKey: "platform.companies.sector.fintech" },
  { value: "artificial_intelligence", labelKey: "platform.companies.sector.ai" },
  { value: "cleantech", labelKey: "platform.companies.sector.cleantech" },
  { value: "healthcare", labelKey: "platform.companies.sector.healthcare" },
  { value: "logistics", labelKey: "platform.companies.sector.logistics" },
  { value: "real_estate", labelKey: "platform.companies.sector.real_estate" },
  { value: "ecommerce", labelKey: "platform.companies.sector.ecommerce" },
  { value: "manufacturing", labelKey: "platform.companies.sector.manufacturing" },
  { value: "energy", labelKey: "platform.companies.sector.energy" },
  { value: "tourism", labelKey: "platform.companies.sector.tourism" },
  { value: "education", labelKey: "platform.companies.sector.education" },
  { value: "agritech", labelKey: "platform.companies.sector.agritech" },
  { value: "space", labelKey: "platform.companies.sector.space" },
  { value: "defense", labelKey: "platform.companies.sector.defense" },
];

const REGIONS: { value: string; labelKey: string }[] = [
  { value: "all", labelKey: "platform.companies.region.all" },
  { value: "AE", labelKey: "platform.companies.region.AE" },
  { value: "SA", labelKey: "platform.companies.region.SA" },
  { value: "QA", labelKey: "platform.companies.region.QA" },
  { value: "EG", labelKey: "platform.companies.region.EG" },
  { value: "BH", labelKey: "platform.companies.region.BH" },
  { value: "KW", labelKey: "platform.companies.region.KW" },
  { value: "OM", labelKey: "platform.companies.region.OM" },
  { value: "JO", labelKey: "platform.companies.region.JO" },
  { value: "US", labelKey: "platform.companies.region.US" },
  { value: "GB", labelKey: "platform.companies.region.GB" },
  { value: "IN", labelKey: "platform.companies.region.IN" },
  { value: "SG", labelKey: "platform.companies.region.SG" },
];

type Sort = "score" | "investability" | "alignment" | "signals" | "recent";

export default function CompaniesPage() {
  const { t } = useLocale();
  const { data, isLoading, error } = useSWR(
    "companies-pipeline",
    () => api.companies({ limit: 200 }),
  );

  const [sector, setSector] = useState<Sector | "all">("all");
  const [region, setRegion] = useState<string>("all");
  const [minScore, setMinScore] = useState(0);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("score");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data.items.filter((c) => {
      if (sector !== "all" && !c.sectors.includes(sector)) return false;
      if (region !== "all") {
        const codes: string[] = [];
        if (c.headquarters?.country_code) codes.push(c.headquarters.country_code);
        for (const t of c.expansion_targets) if (t.country_code) codes.push(t.country_code);
        if (!codes.includes(region)) return false;
      }
      const avg = (c.investability_score + c.uae_alignment_score) / 2;
      if (avg < minScore) return false;
      if (q) {
        const hay = `${c.name} ${c.description ?? ""} ${c.aliases.join(" ")}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });

    list = list.sort((a, b) => {
      switch (sort) {
        case "investability":
          return b.investability_score - a.investability_score;
        case "alignment":
          return b.uae_alignment_score - a.uae_alignment_score;
        case "signals":
          return b.signals.length - a.signals.length;
        case "recent":
          return new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime();
        default:
          return (
            (b.investability_score + b.uae_alignment_score) / 2 -
            (a.investability_score + a.uae_alignment_score) / 2
          );
      }
    });
    return list;
  }, [data, sector, region, minScore, q, sort]);

  // Reset to page 1 when any filter/sort changes so the user isn't
  // stranded on an empty trailing page after a narrowing filter.
  useEffect(() => {
    setPage(1);
  }, [sector, region, minScore, q, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PER_PAGE;
  const pageEnd = pageStart + PER_PAGE;
  const paginated = filtered.slice(pageStart, pageEnd);

  return (
    <PlatformShell
      title={t("platform.companies.title")}
      subtitle={t("platform.companies.subtitle")}
    >
      {/* Filter bar */}
      <div className="surface-card p-5 mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          <div className="lg:col-span-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("platform.companies.search.placeholder")}
              className="w-full bg-sand-100 border border-line rounded-[3px] pl-9 pr-3 py-2.5 text-sm text-navy-800 placeholder:text-ink-400 focus:outline-none focus:border-navy-300 focus:bg-white transition-colors"
            />
          </div>

          <div className="lg:col-span-3">
            <FilterSelect
              label={t("platform.companies.sectorLabel")}
              value={sector}
              onChange={(v) => setSector(v as Sector | "all")}
              options={SECTORS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
            />
          </div>

          <div className="lg:col-span-2">
            <FilterSelect
              label={t("platform.companies.regionLabel")}
              value={region}
              onChange={setRegion}
              options={REGIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
            />
          </div>

          <div className="lg:col-span-3">
            <label className="block text-[10px] uppercase tracking-[0.2em] text-ink-400 mb-1.5 font-medium">
              {t("platform.companies.minScore")} · {minScore}
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-full accent-gold-500"
            />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-line pt-4 flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs text-ink-500">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {filtered.length} {t("platform.companies.countOfTotal")} {data?.items.length ?? 0} {t("platform.companies.countSuffix")}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            <span className="text-xs text-ink-400 shrink-0">{t("platform.companies.sortBy")}</span>
            <div className="flex items-center gap-1 bg-white border border-line rounded-[3px] p-1">
              {(
                [
                  ["score", "platform.companies.sort.score"],
                  ["investability", "platform.companies.sort.investability"],
                  ["alignment", "platform.companies.sort.alignment"],
                  ["signals", "platform.companies.sort.signals"],
                  ["recent", "platform.companies.sort.recent"],
                ] as [Sort, string][]
              ).map(([v, key]) => (
                <button
                  key={v}
                  onClick={() => setSort(v)}
                  className={cn(
                    "px-3 py-1 text-xs rounded-[2px] transition-colors",
                    sort === v
                      ? "bg-navy-800 text-white"
                      : "text-ink-500 hover:text-navy-800",
                  )}
                >
                  {t(key)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <EmptyState
          title={t("platform.companies.error.title")}
          body={t("platform.companies.error.body")}
        />
      )}

      {isLoading && !data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="surface-card p-6 animate-pulse h-56" />
          ))}
        </div>
      )}

      {data && filtered.length === 0 && (
        <EmptyState
          title={t("platform.companies.empty.title")}
          body={t("platform.companies.empty.body")}
        />
      )}

      {filtered.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginated.map((c) => (
              <CompanyCard key={c.id} company={c} />
            ))}
          </div>

          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageStart={pageStart}
              pageEnd={Math.min(pageEnd, filtered.length)}
              totalItems={filtered.length}
              itemNounKey="common.pagination.noun.companies"
              itemNounFallback="companies"
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

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-[0.2em] text-ink-400 mb-1.5 font-medium">
        {label}
      </span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-sand-100 border border-line rounded-[3px] py-2.5 pl-3 pr-9 text-sm text-navy-800 focus:outline-none focus:border-navy-300 focus:bg-white transition-colors cursor-pointer"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ArrowDown01 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
      </div>
    </label>
  );
}

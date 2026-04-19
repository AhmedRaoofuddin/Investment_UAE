"use client";

// Shared pagination control used by /platform/signals, /platform/companies,
// /workspace/notifications, /workspace/watchlist. Clients pass in the total,
// page size, current page, and a noun ("signals", "companies", …) that gets
// translated and shown in the "Showing 1–24 of N <noun>" line.
//
// RTL: chevrons mirror via `rtl:-scale-x-100`. The `Showing`, `of`, `Prev`,
// `Next` strings come from the `common.pagination.*` dictionary namespace
// so every paginated surface reads the same in EN and AR.

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageStart: number;
  pageEnd: number;
  totalItems: number;
  /** Translation key for the pluralised noun, e.g. "common.pagination.noun.signals". */
  itemNounKey: string;
  /** Optional fallback for the noun when the dictionary misses (English default). */
  itemNounFallback?: string;
  onChange: (page: number) => void;
  /** Top margin in addition to the default — use "mt-6" to override default "mt-8 md:mt-10". */
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  pageStart,
  pageEnd,
  totalItems,
  itemNounKey,
  itemNounFallback,
  onChange,
  className,
}: PaginationProps) {
  const { t } = useLocale();
  const pages = getPageRange(currentPage, totalPages);

  return (
    <div
      className={cn(
        "mt-8 md:mt-10 flex items-center justify-between gap-4 flex-wrap",
        className,
      )}
    >
      <div className="text-xs text-ink-500">
        {t("common.pagination.showing")}{" "}
        <span className="font-medium text-navy-800">{pageStart + 1}</span>
        –<span className="font-medium text-navy-800">{pageEnd}</span>{" "}
        {t("common.pagination.of")}{" "}
        <span className="font-medium text-navy-800">{totalItems}</span>{" "}
        {t(itemNounKey, itemNounFallback)}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-line bg-white text-navy-700 rounded-[3px] hover:border-navy-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label={t("common.pagination.prevAria")}
        >
          <ChevronLeft className="w-3.5 h-3.5 rtl:-scale-x-100" />
          {t("common.pagination.prev")}
        </button>

        {pages.map((p, i) =>
          p === "…" ? (
            <span
              key={`ellipsis-${i}`}
              className="px-2 text-xs text-ink-400 select-none"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={cn(
                "min-w-[32px] px-2 py-1.5 text-xs font-medium rounded-[3px] transition-colors",
                p === currentPage
                  ? "bg-navy-800 text-white"
                  : "bg-white border border-line text-navy-700 hover:border-navy-300",
              )}
              aria-current={p === currentPage ? "page" : undefined}
            >
              {p}
            </button>
          ),
        )}

        <button
          onClick={() => onChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-line bg-white text-navy-700 rounded-[3px] hover:border-navy-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label={t("common.pagination.nextAria")}
        >
          {t("common.pagination.next")}
          <ChevronRight className="w-3.5 h-3.5 rtl:-scale-x-100" />
        </button>
      </div>
    </div>
  );
}

/**
 * Build a page-number range with ellipses.
 * Example outputs: [1,2,3,4,5], [1,'…',4,5,6,'…',12], [1,2,3,'…',12]
 */
function getPageRange(current: number, total: number): (number | "…")[] {
  const delta = 1;
  const range: (number | "…")[] = [];
  const rangeWithDots: (number | "…")[] = [];
  let last: number | undefined;

  for (let i = 1; i <= total; i++) {
    if (
      i === 1 ||
      i === total ||
      (i >= current - delta && i <= current + delta)
    ) {
      range.push(i);
    }
  }

  for (const p of range) {
    if (last !== undefined && typeof p === "number") {
      if (p - last === 2) {
        rangeWithDots.push(last + 1);
      } else if (p - last !== 1) {
        rangeWithDots.push("…");
      }
    }
    rangeWithDots.push(p);
    if (typeof p === "number") last = p;
  }

  return rangeWithDots;
}

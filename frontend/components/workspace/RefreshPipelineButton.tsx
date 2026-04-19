"use client";

// "Refresh pipeline" button.
//
// Hits the backend FastAPI `/api/refresh` endpoint via the existing
// `/api/proxy/*` pass-through. The backend's refresh runs the
// open-source ML agent pipeline (embedding + classifier + entity +
// scoring) against the full RSS source list, merges new signals into
// the snapshot, and returns the new company count.
//
// No Claude / Anthropic dependency — works on pipelines where the LLM
// prose layer is offline. Matched briefings generated *after* a refresh
// will differ because the underlying signal pool has changed.
//
// Runtime behaviour:
//   - Button shows "Refresh pipeline" in idle state.
//   - Click: swaps to "Refreshing…" with spinner for up to 60s.
//   - Success: success toast with new company count; reload so SWR
//     polls on all workspace surfaces pick up fresh data.
//   - Failure: error toast with the backend reason (timeout, 5xx, etc.).
//
// The button is stateless w.r.t. "last run" so we show the backend's
// own `cache_age_minutes` as a hint before click — retrieved via the
// health endpoint when the component mounts.

import { useEffect, useState } from "react";
import { RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type Status =
  | { phase: "idle" }
  | { phase: "refreshing" }
  | { phase: "success"; companyCount: number }
  | { phase: "error"; reason: string };

export function RefreshPipelineButton({
  className,
  size = "md",
}: {
  className?: string;
  /** "sm" fits inline next to other action buttons; "md" stands alone. */
  size?: "sm" | "md";
}) {
  const { t } = useLocale();
  const [status, setStatus] = useState<Status>({ phase: "idle" });
  const [cacheAgeMin, setCacheAgeMin] = useState<number | null>(null);

  // Probe the backend for cache age on mount. This is a cheap GET so we
  // can tell the user how stale the data is before they refresh.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/proxy/api/health", { cache: "no-store" });
        if (!r.ok) return;
        const json = (await r.json()) as { cache_age_minutes?: number };
        if (!cancelled && typeof json.cache_age_minutes === "number") {
          setCacheAgeMin(json.cache_age_minutes);
        }
      } catch {
        // Silent — the button still works, we just won't show an age hint.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRefresh() {
    setStatus({ phase: "refreshing" });
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90_000);
      const r = await fetch("/api/proxy/api/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!r.ok) {
        setStatus({
          phase: "error",
          reason: `upstream_${r.status}`,
        });
        return;
      }
      const json = (await r.json()) as {
        ok?: boolean;
        company_count?: number;
      };
      if (json.ok === false) {
        setStatus({ phase: "error", reason: "pipeline_failed" });
        return;
      }
      setStatus({
        phase: "success",
        companyCount: json.company_count ?? 0,
      });
      // Give the user 1.5s to read the success toast, then reload so
      // every SWR-backed view (Pulse, Dashboard, Overview) re-fetches.
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const reason =
        msg.includes("aborted") || msg.includes("timeout")
          ? "timeout"
          : "network";
      setStatus({ phase: "error", reason });
    }
  }

  const pending = status.phase === "refreshing";
  const isSm = size === "sm";

  return (
    <div className={cn("flex items-center gap-3 flex-wrap", className)}>
      <button
        type="button"
        onClick={handleRefresh}
        disabled={pending}
        className={cn(
          "inline-flex items-center gap-2 rounded-[3px] font-medium transition-colors whitespace-nowrap",
          isSm ? "px-3 h-8 text-xs" : "px-4 h-10 text-sm",
          "border border-navy-200 bg-white text-navy-800 hover:border-navy-400 hover:bg-navy-50",
          "disabled:opacity-60 disabled:cursor-not-allowed",
        )}
        aria-label={t("workspace.refresh.cta", "Refresh pipeline")}
      >
        <RefreshCw
          className={cn(isSm ? "w-3.5 h-3.5" : "w-4 h-4", pending && "animate-spin")}
        />
        {pending
          ? t("workspace.refresh.running", "Refreshing…")
          : t("workspace.refresh.cta", "Refresh pipeline")}
      </button>

      {status.phase === "idle" && cacheAgeMin !== null && (
        <span className="text-[11px] text-ink-500">
          {cacheAgeMin < 1
            ? t("workspace.refresh.cacheFresh", "Data is fresh")
            : t("workspace.refresh.cacheAge", "Data is {n} min old").replace(
                "{n}",
                String(cacheAgeMin),
              )}
        </span>
      )}

      {status.phase === "success" && (
        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {t(
            "workspace.refresh.success",
            "Pipeline refreshed · {n} companies",
          ).replace("{n}", String(status.companyCount))}
        </span>
      )}

      {status.phase === "error" && (
        <span className="inline-flex items-center gap-1.5 text-xs text-amber-700">
          <AlertTriangle className="w-3.5 h-3.5" />
          {status.reason === "timeout"
            ? t(
                "workspace.refresh.timeout",
                "Refresh timed out. The backend may still be running; try again in a minute.",
              )
            : t(
                "workspace.refresh.error",
                "Refresh failed ({r}).",
              ).replace("{r}", status.reason)}
        </span>
      )}
    </div>
  );
}

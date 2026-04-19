"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api/client";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const TABS = [
  { href: "/platform", tKey: "overview", icon: "/icons/ministry/fact-fdi.svg" },
  { href: "/platform/signals", tKey: "signals", icon: "/icons/ministry/connectivity.svg" },
  { href: "/platform/companies", tKey: "companies", icon: "/icons/ministry/buildings.svg" },
  { href: "/platform/geo", tKey: "geo", icon: "/icons/ministry/globe-pin.svg" },
  { href: "/platform/sectors", tKey: "sectors", icon: "/icons/ministry/chart-line.svg" },
] as const;

export function PlatformShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLocale();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);

  // On a single-company dossier route the cheap+correct refresh is to re-run
  // just /api/companies/{id} (one Opus call, ~5–10s) — NOT the full pipeline,
  // which re-ingests RSS, re-extracts every signal, and would either return
  // an unrelated set of companies or invalidate this dossier's id entirely.
  const isDossier = /^\/platform\/companies\/[^/]+/.test(pathname);

  async function onRefresh() {
    if (refreshing) return;
    setRefreshing(true);

    if (isDossier) {
      setRefreshMsg(t("platform.regenRunning"));
      try {
        router.refresh();
        setRefreshMsg(t("platform.regenComplete"));
      } catch (e) {
        setRefreshMsg(t("platform.regenFailed"));
      } finally {
        setTimeout(() => {
          setRefreshing(false);
          setRefreshMsg(null);
        }, 2500);
      }
      return;
    }

    setRefreshMsg(t("platform.refreshRunning"));
    try {
      await api.refresh();
      setRefreshMsg(t("platform.refreshComplete"));
      setTimeout(() => window.location.reload(), 700);
    } catch (e) {
      setRefreshMsg(t("platform.refreshFailed"));
    } finally {
      setTimeout(() => setRefreshing(false), 1500);
    }
  }

  return (
    <div>
      {/* Sub-nav */}
      <div className="bg-white border-b border-line">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-10 flex items-center gap-1 overflow-x-auto h-12 md:h-14 scrollbar-hide">
          {TABS.map((tab) => {
            const active =
              tab.href === "/platform"
                ? pathname === "/platform"
                : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "inline-flex items-center gap-1.5 md:gap-2 px-3 md:px-4 h-full text-[12px] md:text-[13px] font-medium transition-colors border-b-2 -mb-px whitespace-nowrap shrink-0",
                  active
                    ? "text-navy-900 border-gold-500"
                    : "text-ink-500 border-transparent hover:text-navy-900",
                )}
              >
                <Image
                  src={tab.icon}
                  alt=""
                  width={16}
                  height={16}
                  aria-hidden="true"
                  className="shrink-0"
                />
                {t(`platform.tab.${tab.tKey}`)}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Page header */}
      <div className="bg-gradient-to-b from-white to-sand-50 border-b border-line">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-10 py-6 md:py-10 flex items-end justify-between gap-4 md:gap-6 flex-wrap">
          <div>
            <h1 className="headline-serif text-navy-800 text-3xl md:text-4xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2 text-ink-500 max-w-2xl leading-relaxed">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {refreshMsg && (
              <span className="text-xs text-ink-500 max-w-[260px] leading-snug">
                {refreshMsg}
              </span>
            )}
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium border border-line bg-white hover:border-navy-300 text-navy-700 rounded-[3px] transition-colors disabled:opacity-60"
            >
              <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
              {isDossier ? t("platform.regenerateBtn") : t("platform.refreshBtn")}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-10 py-6 md:py-10">{children}</div>
    </div>
  );
}

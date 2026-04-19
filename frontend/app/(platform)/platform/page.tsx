"use client";

import Link from "next/link";
import useSWR from "swr";
import { ArrowUpRight } from "lucide-react";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { CompanyCard } from "@/components/platform/CompanyCard";
import { SignalCard } from "@/components/platform/SignalCard";
import { EmptyState } from "@/components/platform/EmptyState";
import { Card, CardBody } from "@/components/ui/primitives";
import { api } from "@/lib/api/client";
import type { Company, Signal } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";

async function fetchOverview() {
  try {
    const [companies, sectors, geo] = await Promise.all([
      api.companies({ limit: 60 }),
      api.sectors(),
      api.geo(),
    ]);
    return { companies, sectors, geo, ok: true as const };
  } catch (err) {
    return {
      ok: false as const,
      error:
        err instanceof Error
          ? err.message
          : "Backend unreachable. Start it with `uvicorn app.main:app`.",
    };
  }
}

export default function PlatformHome() {
  const { t } = useLocale();
  const { data } = useSWR("platform-overview", fetchOverview);

  if (!data) {
    return (
      <PlatformShell
        title={t("platform.overview.title")}
        subtitle={t("platform.overview.subtitleShort")}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white p-6 h-28 animate-pulse" />
          ))}
        </div>
      </PlatformShell>
    );
  }

  if (!data.ok) {
    return (
      <PlatformShell
        title={t("platform.overview.title")}
        subtitle={t("platform.overview.subtitleShort")}
      >
        <EmptyState
          title={t("platform.overview.backendDown.title")}
          body={t("platform.overview.backendDown.body")}
          cta={{ label: t("platform.overview.backendDown.cta"), onClick: undefined }}
        />
      </PlatformShell>
    );
  }

  const companies: Company[] = data.companies.items;
  const totalSignals = companies.reduce((acc, c) => acc + c.signals.length, 0);
  const top = companies.slice(0, 6);
  const signals: Signal[] = companies
    .flatMap((c) => c.signals.map((s) => ({ ...s, _company: c.name })))
    .sort(
      (a, b) =>
        new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime(),
    )
    .slice(0, 6);

  const KPIs = [
    {
      label: t("platform.overview.kpi.companies"),
      value: data.companies.total,
      sub: t("platform.overview.kpi.companiesSub").replace(
        "{count}",
        String(data.sectors.items.length),
      ),
    },
    {
      label: t("platform.overview.kpi.signals"),
      value: totalSignals,
      sub: t("platform.overview.kpi.signalsSub"),
    },
    {
      label: t("platform.overview.kpi.geo"),
      value: data.geo.items.length,
      sub: t("platform.overview.kpi.geoSub"),
    },
    {
      label: t("platform.overview.kpi.latency"),
      value: `${(data.companies.pipeline_run_ms / 1000).toFixed(1)}s`,
      sub: t("platform.overview.kpi.latencySub"),
    },
  ];

  return (
    <PlatformShell
      title={t("platform.overview.title")}
      subtitle={t("platform.overview.subtitle")}
    >
      {companies.length === 0 ? (
        <EmptyState
          title={t("platform.overview.emptyTitle")}
          body={t("platform.overview.emptyBody")}
        />
      ) : (
        <div className="space-y-12">
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line">
            {KPIs.map((k) => (
              <div key={k.label} className="bg-white p-6">
                <div className="text-[10.5px] uppercase tracking-[0.2em] text-gold-600 font-medium">
                  {k.label}
                </div>
                <div className="mt-2 headline-serif text-3xl text-navy-800 tracking-tight">
                  {k.value}
                </div>
                <div className="mt-1 text-xs text-ink-500">{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Top companies */}
          <section>
            <div className="flex items-end justify-between mb-6">
              <div>
                <span className="eyebrow">{t("platform.overview.topEyebrow")}</span>
                <h2 className="headline-serif text-navy-800 text-2xl mt-2">
                  {t("platform.overview.topTitle")}
                </h2>
              </div>
              <Link
                href="/platform/companies"
                className="text-navy-700 hover:text-gold-600 text-sm font-medium inline-flex items-center gap-1"
              >
                {t("platform.overview.topLink")} <ArrowUpRight className="w-4 h-4 rtl:-scale-x-100" />
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {top.map((c) => (
                <CompanyCard key={c.id} company={c} />
              ))}
            </div>
          </section>

          {/* Recent signals */}
          <section>
            <div className="flex items-end justify-between mb-6">
              <div>
                <span className="eyebrow">{t("platform.overview.recentEyebrow")}</span>
                <h2 className="headline-serif text-navy-800 text-2xl mt-2">
                  {t("platform.overview.recentTitle")}
                </h2>
              </div>
              <Link
                href="/platform/signals"
                className="text-navy-700 hover:text-gold-600 text-sm font-medium inline-flex items-center gap-1"
              >
                {t("platform.overview.recentLink")} <ArrowUpRight className="w-4 h-4 rtl:-scale-x-100" />
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {signals.map((s) => (
                <SignalCard
                  key={s.id}
                  signal={s}
                  companyName={(s as Signal & { _company?: string })._company}
                />
              ))}
            </div>
          </section>

          {/* Source brief */}
          <Card>
            <CardBody className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div>
                <span className="eyebrow">{t("platform.overview.sourcesEyebrow")}</span>
                <h3 className="headline-serif text-navy-800 text-xl mt-3">
                  {t("platform.overview.sourcesTitle")}
                </h3>
              </div>
              <p className="text-sm text-ink-500 leading-relaxed lg:col-span-2">
                {t("platform.overview.sourcesBody")}
              </p>
            </CardBody>
          </Card>
        </div>
      )}
    </PlatformShell>
  );
}

"use client";

import useSWR from "swr";
import { useMemo } from "react";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { GeoMap } from "@/components/platform/GeoMap";
import { EmptyState } from "@/components/platform/EmptyState";
import { Card, CardBody, Eyebrow } from "@/components/ui/primitives";
import { api } from "@/lib/api/client";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export default function GeoPage() {
  const { t } = useLocale();
  const { data, error, isLoading } = useSWR("geo", () => api.geo());
  const { data: companies } = useSWR("companies-geo-side", () =>
    api.companies({ limit: 100 }),
  );

  const stats = useMemo(() => {
    if (!data) return null;
    const hq = data.items.filter((p) => p.intent === "headquarters").length;
    const targets = data.items.filter(
      (p) => p.intent === "expansion_target",
    ).length;
    const countries = new Set(
      data.items.map((p) => `${p.lat.toFixed(0)},${p.lng.toFixed(0)}`),
    ).size;
    return { hq, targets, countries };
  }, [data]);

  return (
    <PlatformShell
      title={t("platform.geo.title")}
      subtitle={t("platform.geo.subtitle")}
    >
      {error && (
        <EmptyState
          title={t("platform.geo.error.title")}
          body={t("platform.geo.error.body")}
        />
      )}
      {isLoading && !data && (
        <div className="aspect-[1100/540] surface-card animate-pulse" />
      )}
      {data && (
        <div className="space-y-8">
          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-line border border-line">
              <Stat label={t("platform.geo.stat.hq")} value={stats.hq} />
              <Stat label={t("platform.geo.stat.targets")} value={stats.targets} />
              <Stat label={t("platform.geo.stat.locations")} value={stats.countries} />
            </div>
          )}

          <GeoMap points={data.items} />

          {companies && (
            <Card>
              <CardBody className="p-6">
                <Eyebrow>{t("platform.geo.topLocations")}</Eyebrow>
                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {topLocations(companies.items).map((row) => (
                    <div
                      key={row.key}
                      className="flex items-center justify-between border-l-2 border-gold-500 pl-4 py-2"
                    >
                      <div>
                        <div className="text-sm font-semibold text-navy-800">
                          {row.label}
                        </div>
                        <div className="text-[11px] text-ink-500">
                          {row.count} {t("platform.geo.companiesAvg")} {row.avgScore}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </PlatformShell>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white p-6">
      <div className="text-[10px] uppercase tracking-[0.22em] text-gold-600 font-medium">
        {label}
      </div>
      <div className="mt-2 headline-serif text-3xl text-navy-800">{value}</div>
    </div>
  );
}

interface TopLocation {
  key: string;
  label: string;
  count: number;
  avgScore: number;
}
function topLocations(companies: import("@/lib/types").Company[]): TopLocation[] {
  const buckets = new Map<string, { count: number; sum: number; label: string }>();
  for (const c of companies) {
    const hq = c.headquarters;
    if (!hq?.country) continue;
    const key = hq.city ? `${hq.city}, ${hq.country}` : hq.country;
    const cur = buckets.get(key) ?? { count: 0, sum: 0, label: key };
    cur.count += 1;
    cur.sum += (c.investability_score + c.uae_alignment_score) / 2;
    buckets.set(key, cur);
  }
  return Array.from(buckets.entries())
    .map(([key, v]) => ({
      key,
      label: v.label,
      count: v.count,
      avgScore: Math.round(v.sum / v.count),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 9);
}

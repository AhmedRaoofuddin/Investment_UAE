"use client";

import useSWR from "swr";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { Card, CardBody, Eyebrow } from "@/components/ui/primitives";
import { EmptyState } from "@/components/platform/EmptyState";
import { ScorePill } from "@/components/ui/score-pill";
import { api } from "@/lib/api/client";
import { sectorLabel } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * Map a backend `Sector` enum value to a dictionary key under the
 * existing `platform.companies.sector.*` namespace so chart axes and
 * the table render in the active locale. Keys mirror the options list
 * in `/platform/companies`. Unknown values fall back to the title-cased
 * English label via `sectorLabel()`.
 */
function localizedSector(sector: string, t: (k: string, fb?: string) => string): string {
  const keyMap: Record<string, string> = {
    fintech: "platform.companies.sector.fintech",
    artificial_intelligence: "platform.companies.sector.ai",
    cleantech: "platform.companies.sector.cleantech",
    healthcare: "platform.companies.sector.healthcare",
    logistics: "platform.companies.sector.logistics",
    real_estate: "platform.companies.sector.real_estate",
    ecommerce: "platform.companies.sector.ecommerce",
    manufacturing: "platform.companies.sector.manufacturing",
    energy: "platform.companies.sector.energy",
    tourism: "platform.companies.sector.tourism",
    education: "platform.companies.sector.education",
    agritech: "platform.companies.sector.agritech",
    space: "platform.companies.sector.space",
    defense: "platform.companies.sector.defense",
    other: "platform.companies.sector.other",
  };
  const key = keyMap[sector];
  return key ? t(key, sectorLabel(sector)) : sectorLabel(sector);
}

const NAVY = "#0E1E3F";
const GOLD = "#B6925E";
const GOLD_LIGHT = "#D8B468";
const SAND = "#E6E4D8";

export default function SectorsPage() {
  const { t, locale } = useLocale();
  const { data, error, isLoading } = useSWR("sectors", () => api.sectors());
  const isRtl = locale === "ar";

  return (
    <PlatformShell
      title={t("platform.sectors.title")}
      subtitle={t("platform.sectors.subtitle")}
    >
      {error && (
        <EmptyState
          title={t("platform.sectors.error.title")}
          body={t("platform.sectors.error.body")}
        />
      )}
      {isLoading && !data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="surface-card animate-pulse h-96" />
          <div className="surface-card animate-pulse h-96" />
        </div>
      )}
      {data && data.items.length === 0 && (
        <EmptyState
          title={t("platform.sectors.empty.title")}
          body={t("platform.sectors.empty.body")}
        />
      )}
      {data && data.items.length > 0 && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardBody className="p-6">
                <Eyebrow>{t("platform.sectors.chart.companiesBySector")}</Eyebrow>
                <div className={isRtl ? "h-[520px] mt-4" : "h-[420px] mt-4"}>
                  <ResponsiveContainer>
                    <BarChart
                      layout={isRtl ? "vertical" : "horizontal"}
                      data={data.items.map((s) => ({
                        sector: localizedSector(s.sector, t),
                        [t("platform.sectors.chart.companies")]: s.company_count,
                        [t("platform.sectors.chart.signals")]: s.signal_count,
                      }))}
                      margin={
                        isRtl
                          ? { top: 16, right: 16, bottom: 16, left: 110 }
                          : { top: 16, right: 24, bottom: 80, left: 0 }
                      }
                      barCategoryGap={isRtl ? 8 : 12}
                    >
                      <CartesianGrid
                        stroke={SAND}
                        horizontal={isRtl ? false : true}
                        vertical={isRtl ? true : false}
                      />
                      {isRtl ? (
                        <>
                          {/* Horizontal bars: X = numeric count, Y = sector */}
                          <XAxis
                            type="number"
                            tick={{ fill: "#5A6378", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            orientation="top"
                          />
                          <YAxis
                            type="category"
                            dataKey="sector"
                            tick={{
                              fill: "#5A6378",
                              fontSize: 12,
                              direction: "rtl",
                            }}
                            width={108}
                            interval={0}
                            axisLine={false}
                            tickLine={false}
                            orientation="right"
                          />
                        </>
                      ) : (
                        <>
                          <XAxis
                            dataKey="sector"
                            tick={{ fill: "#5A6378", fontSize: 11 }}
                            angle={-25}
                            textAnchor="end"
                            interval={0}
                            height={70}
                          />
                          <YAxis
                            tick={{ fill: "#5A6378", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                          />
                        </>
                      )}
                      <Tooltip
                        cursor={{ fill: "rgba(8,21,44,0.04)" }}
                        contentStyle={{
                          background: "white",
                          border: "1px solid #E6E4D8",
                          fontSize: 12,
                          color: NAVY,
                          borderRadius: 6,
                        }}
                      />
                      <Bar
                        dataKey={t("platform.sectors.chart.companies")}
                        fill={NAVY}
                        radius={isRtl ? [0, 3, 3, 0] : [3, 3, 0, 0]}
                      />
                      <Bar
                        dataKey={t("platform.sectors.chart.signals")}
                        fill={GOLD}
                        radius={isRtl ? [0, 3, 3, 0] : [3, 3, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody className="p-6">
                <Eyebrow>{t("platform.sectors.chart.quality")}</Eyebrow>
                <div className="h-[360px] mt-4">
                  <ResponsiveContainer>
                    <RadialBarChart
                      innerRadius="30%"
                      outerRadius="100%"
                      data={data.items
                        .slice(0, 8)
                        .map((s, i) => ({
                          name: localizedSector(s.sector, t),
                          value: s.avg_score,
                          fill:
                            s.avg_score >= 70
                              ? GOLD
                              : s.avg_score >= 45
                                ? GOLD_LIGHT
                                : NAVY,
                        }))}
                      startAngle={90}
                      endAngle={-270}
                    >
                      <PolarAngleAxis
                        type="number"
                        domain={[0, 100]}
                        tick={false}
                      />
                      <RadialBar dataKey="value" background cornerRadius={3} />
                      <Tooltip
                        contentStyle={{
                          background: "white",
                          border: "1px solid #E6E4D8",
                          fontSize: 12,
                          color: NAVY,
                          borderRadius: 6,
                        }}
                      />
                    </RadialBarChart>
                  </ResponsiveContainer>
                </div>
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardBody className="p-0 overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="bg-sand-100 border-b border-line">
                  <tr className="text-left">
                    <th className="px-6 py-3 text-[10px] uppercase tracking-[0.2em] text-ink-500 font-medium">
                      {t("platform.sectors.table.sector")}
                    </th>
                    <th className="px-6 py-3 text-[10px] uppercase tracking-[0.2em] text-ink-500 font-medium">
                      {t("platform.sectors.table.companies")}
                    </th>
                    <th className="px-6 py-3 text-[10px] uppercase tracking-[0.2em] text-ink-500 font-medium">
                      {t("platform.sectors.table.signals")}
                    </th>
                    <th className="px-6 py-3 text-[10px] uppercase tracking-[0.2em] text-ink-500 font-medium">
                      {t("platform.sectors.table.avgScore")}
                    </th>
                    <th className="px-6 py-3 text-[10px] uppercase tracking-[0.2em] text-ink-500 font-medium">
                      {t("platform.sectors.table.topCompanies")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((s) => (
                    <tr
                      key={s.sector}
                      className="border-b border-line last:border-b-0 hover:bg-sand-50 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-navy-800">
                        {localizedSector(s.sector, t)}
                      </td>
                      <td className="px-6 py-4 text-navy-700">
                        {s.company_count}
                      </td>
                      <td className="px-6 py-4 text-navy-700">
                        {s.signal_count}
                      </td>
                      <td className="px-6 py-4">
                        <ScorePill score={s.avg_score} />
                      </td>
                      <td className="px-6 py-4 text-sm text-ink-500">
                        {s.top_companies.slice(0, 3).join(" · ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>
        </div>
      )}
    </PlatformShell>
  );
}

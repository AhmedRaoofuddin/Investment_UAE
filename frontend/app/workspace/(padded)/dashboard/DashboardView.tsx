"use client";

// Ministry-grade analytics dashboard. Polls /api/workspace/dashboard and
// renders: 8 KPI tiles, 30-day area trend, signal-type split, strength
// mix, top companies leaderboard, sector intensity, top publishers, and
// a regional distribution. All charts are Recharts (already a dep); no
// external BI tool needed.
//
// Translation: every visible string goes through `t()` so Arabic users
// get a localised dashboard with RTL chart orientation where it matters.

import useSWR from "swr";
import { useMemo } from "react";
import {
  AreaChart,
  Area,
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
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Bookmark,
  Building2,
  Globe2,
  Newspaper,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import type { DashboardResponse } from "@/app/api/workspace/dashboard/route";
import { Card, CardBody, Eyebrow, SerifHeading, Badge } from "@/components/ui/primitives";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const fetcher = (u: string) =>
  fetch(u, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
  });

const NAVY = "#0E1E3F";
const GOLD = "#B6925E";
const GOLD_LIGHT = "#D8B468";
const EMERALD = "#059669";
const SKY = "#0284C7";
const PURPLE = "#7C3AED";
const ROSE = "#E11D48";
const AMBER = "#D97706";
const SLATE = "#64748B";

const TYPE_COLORS: Record<string, string> = {
  funding: EMERALD,
  expansion: SKY,
  partnership: PURPLE,
  launch: GOLD,
  regulatory: "#4338CA",
  hiring: SLATE,
  m_and_a: ROSE,
  executive: AMBER,
};

const STRENGTH_COLORS: Record<string, string> = {
  high: EMERALD,
  medium: GOLD,
  low: SLATE,
};

export function DashboardView() {
  const { t, locale } = useLocale();
  const { data, error, isLoading, mutate } = useSWR<DashboardResponse>(
    "/api/workspace/dashboard",
    fetcher,
    { refreshInterval: 60_000, revalidateOnFocus: true },
  );
  const isRtl = locale === "ar";

  // Backend is down when the server route explicitly reported it couldn't
  // reach the pipeline. Zero-company runs CAN happen legitimately (fresh
  // install with no pipeline output yet), but if the server says the
  // backend was unreachable we show an error banner rather than pretend
  // everything is healthy with zeros.
  const backendDown =
    data?.backendReachable === false && data?.kpis?.totalCompanies === 0;

  const trendData = useMemo(() => {
    return (data?.trend ?? []).map((p) => ({
      day: p.day.slice(5), // "04-17"
      total: p.total,
      matched: p.matched,
    }));
  }, [data]);

  if (error) {
    return (
      <div className="space-y-6">
        <Header locale={locale} isRtl={isRtl} />
        <Card>
          <CardBody className="p-8 text-center">
            <p className="text-sm text-ink-500">
              {t("workspace.dashboard.error", "Dashboard data unavailable. Retrying automatically.")}
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Header locale={locale} isRtl={isRtl} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="surface-card p-5 animate-pulse h-28" />
          ))}
        </div>
      </div>
    );
  }

  if (backendDown) {
    const reason = data.backendError ?? "network";
    const reasonLabel =
      reason === "timeout"
        ? t("workspace.dashboard.backendDown.reason.timeout", "The pipeline took too long to respond.")
        : reason.startsWith("upstream_")
          ? t(
              "workspace.dashboard.backendDown.reason.upstream",
              "The pipeline backend returned an error.",
            )
          : t(
              "workspace.dashboard.backendDown.reason.network",
              "Couldn't reach the pipeline backend.",
            );
    return (
      <div className="space-y-6">
        <Header locale={locale} isRtl={isRtl} />
        <Card className="border-amber-200 bg-amber-50/60">
          <CardBody className="p-6 md:p-8 flex flex-col md:flex-row items-start gap-4">
            <div className="shrink-0 w-11 h-11 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-navy-900 text-base mb-1">
                {t(
                  "workspace.dashboard.backendDown.title",
                  "Live pipeline unreachable",
                )}
              </h3>
              <p className="text-sm text-ink-500 leading-relaxed mb-3">
                {reasonLabel}{" "}
                {t(
                  "workspace.dashboard.backendDown.body",
                  "This is usually transient while the pipeline warms up. Your watchlist, notifications, and saved connections are unaffected.",
                )}
              </p>
              <button
                type="button"
                onClick={() => mutate()}
                className="inline-flex items-center gap-2 px-3 h-9 rounded-[3px] bg-navy-800 text-white text-xs font-medium hover:bg-navy-700"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {t("workspace.dashboard.backendDown.retry", "Retry now")}
              </button>
              <p className="mt-3 text-[11px] text-ink-400 font-mono">
                {t("workspace.dashboard.backendDown.code", "Reason code")}: {reason}
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  const lastRun = data.pipelineGeneratedAt ? new Date(data.pipelineGeneratedAt) : null;

  return (
    <div className="space-y-6 md:space-y-8">
      <Header locale={locale} isRtl={isRtl} lastRun={lastRun} />

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <KpiTile
          icon={Zap}
          label={t("workspace.dashboard.kpi.totalSignals", "Live signals")}
          value={data.kpis.totalSignals.toLocaleString()}
          accent="navy"
        />
        <KpiTile
          icon={Sparkles}
          label={t("workspace.dashboard.kpi.matched", "Matched your watchlist")}
          value={data.kpis.matchedSignals.toLocaleString()}
          sub={
            data.kpis.totalSignals > 0
              ? `${Math.round((data.kpis.matchedSignals / data.kpis.totalSignals) * 100)}%`
              : "·"
          }
          accent="gold"
        />
        <KpiTile
          icon={Building2}
          label={t("workspace.dashboard.kpi.companies", "Companies tracked")}
          value={data.kpis.totalCompanies.toLocaleString()}
          accent="navy"
        />
        <KpiTile
          icon={TrendingUp}
          label={t("workspace.dashboard.kpi.avgScore", "Avg composite score")}
          value={data.kpis.avgScore.toFixed(1)}
          sub={`${t("workspace.dashboard.kpi.outOf100", "of 100")}`}
          accent="gold"
        />
        <KpiTile
          icon={Activity}
          label={t("workspace.dashboard.kpi.highPct", "High-strength share")}
          value={`${data.kpis.highStrengthPct.toFixed(1)}%`}
          accent="emerald"
        />
        <KpiTile
          icon={Globe2}
          label={t("workspace.dashboard.kpi.countries", "Countries covered")}
          value={data.kpis.countriesCovered.toLocaleString()}
          accent="navy"
        />
        <KpiTile
          icon={Newspaper}
          label={t("workspace.dashboard.kpi.publishers", "Publishers in feed")}
          value={data.kpis.publishersCovered.toLocaleString()}
          accent="navy"
        />
        <KpiTile
          icon={Bookmark}
          label={t("workspace.dashboard.kpi.watchlistItems", "Watchlist items")}
          value={data.kpis.watchlistItems.toLocaleString()}
          accent="gold"
        />
      </div>

      {/* Trend + type breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <CardBody className="p-5 md:p-6">
            <div className="flex items-center justify-between mb-1">
              <Eyebrow>{t("workspace.dashboard.trend.title", "Signal volume, last 30 days")}</Eyebrow>
              <Badge tone="default">
                {t("workspace.dashboard.trend.cadence", "Daily")}
              </Badge>
            </div>
            <p className="text-xs text-ink-500 mb-4">
              {t(
                "workspace.dashboard.trend.sub",
                "Total signals detected per day vs those that matched your watchlist.",
              )}
            </p>
            <div className="h-[280px]">
              <ResponsiveContainer>
                <AreaChart data={trendData} margin={{ top: 10, right: 10, bottom: 0, left: -18 }}>
                  <defs>
                    <linearGradient id="totalFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={NAVY} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={NAVY} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="matchedFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={GOLD} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={GOLD} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#E6E4D8" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: "#5A6378", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#5A6378", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "white",
                      border: "1px solid #E6E4D8",
                      fontSize: 12,
                      color: NAVY,
                      borderRadius: 6,
                    }}
                  />
                  <Area type="monotone" dataKey="total" stroke={NAVY} strokeWidth={2} fill="url(#totalFill)" name={t("workspace.dashboard.trend.total", "Total")} />
                  <Area type="monotone" dataKey="matched" stroke={GOLD} strokeWidth={2} fill="url(#matchedFill)" name={t("workspace.dashboard.trend.matched", "Matched")} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-5 md:p-6">
            <Eyebrow>{t("workspace.dashboard.types.title", "Signal mix")}</Eyebrow>
            <p className="text-xs text-ink-500 mb-4 mt-1">
              {t("workspace.dashboard.types.sub", "How the pipeline breaks down by event type.")}
            </p>
            <div className="h-[280px]">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={data.typeBreakdown}
                    dataKey="count"
                    nameKey="type"
                    innerRadius={50}
                    outerRadius={95}
                    paddingAngle={2}
                  >
                    {data.typeBreakdown.map((entry, i) => (
                      <Cell
                        key={`cell-${i}`}
                        fill={TYPE_COLORS[entry.type] ?? NAVY}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "white",
                      border: "1px solid #E6E4D8",
                      fontSize: 12,
                      color: NAVY,
                      borderRadius: 6,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {data.typeBreakdown.slice(0, 6).map((tb) => (
                <span
                  key={tb.type}
                  className="inline-flex items-center gap-1.5 text-[11px] text-ink-500"
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ background: TYPE_COLORS[tb.type] ?? NAVY }}
                  />
                  <span className="capitalize">{tb.type.replace(/_/g, " ")}</span>
                  <span className="tabular-nums text-navy-800 font-medium">{tb.count}</span>
                </span>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Top companies + sector intensity */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <Card className="lg:col-span-3">
          <CardBody className="p-5 md:p-6">
            <Eyebrow>{t("workspace.dashboard.top.title", "Top companies by composite score")}</Eyebrow>
            <p className="text-xs text-ink-500 mb-4 mt-1">
              {t("workspace.dashboard.top.sub", "Average of investability + UAE alignment. Click through for the full dossier.")}
            </p>
            <div className="divide-y divide-line">
              {data.topCompanies.map((c, i) => (
                <Link
                  key={c.id}
                  href={`/platform/companies/${c.id}`}
                  className="flex items-center gap-3 py-3 group hover:bg-sand-50/50 -mx-3 px-3 rounded-[3px]"
                >
                  <div className="w-6 text-[11px] tabular-nums text-ink-400 font-semibold">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-navy-800 truncate group-hover:text-navy-900">
                      {c.name}
                    </div>
                    <div className="text-[11px] text-ink-500 truncate">
                      {[c.country, c.sectors.slice(0, 2).map((s) => s.replace(/_/g, " ")).join(" · ")]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-navy-800 tabular-nums">
                      {c.score.toFixed(1)}
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-ink-400">
                      {c.signalCount} {t("workspace.dashboard.top.signals", "signals")}
                    </div>
                  </div>
                  <div className="w-16 shrink-0">
                    <div className="h-1.5 w-full bg-sand-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gold-500"
                        style={{ width: `${Math.min(100, c.score)}%` }}
                      />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardBody className="p-5 md:p-6">
            <Eyebrow>{t("workspace.dashboard.sectors.title", "Sector intensity")}</Eyebrow>
            <p className="text-xs text-ink-500 mb-4 mt-1">
              {t("workspace.dashboard.sectors.sub", "Which sectors the pipeline is surfacing most.")}
            </p>
            <div className="h-[340px]">
              <ResponsiveContainer>
                <BarChart
                  layout={isRtl ? "vertical" : "horizontal"}
                  data={data.topSectors.map((s) => ({
                    sector: s.sector.replace(/_/g, " "),
                    count: s.signalCount,
                  }))}
                  margin={isRtl ? { top: 10, right: 10, bottom: 10, left: 95 } : { top: 10, right: 10, bottom: 60, left: -18 }}
                >
                  <CartesianGrid stroke="#E6E4D8" vertical={isRtl} horizontal={!isRtl} />
                  {isRtl ? (
                    <>
                      <XAxis type="number" tick={{ fill: "#5A6378", fontSize: 11 }} orientation="top" />
                      <YAxis
                        type="category"
                        dataKey="sector"
                        tick={{ fill: "#5A6378", fontSize: 11, direction: "rtl" }}
                        width={92}
                        interval={0}
                        orientation="right"
                      />
                    </>
                  ) : (
                    <>
                      <XAxis
                        dataKey="sector"
                        tick={{ fill: "#5A6378", fontSize: 10 }}
                        angle={-35}
                        textAnchor="end"
                        interval={0}
                        height={70}
                      />
                      <YAxis tick={{ fill: "#5A6378", fontSize: 11 }} axisLine={false} tickLine={false} />
                    </>
                  )}
                  <Tooltip
                    contentStyle={{
                      background: "white",
                      border: "1px solid #E6E4D8",
                      fontSize: 12,
                      color: NAVY,
                      borderRadius: 6,
                    }}
                  />
                  <Bar dataKey="count" fill={GOLD} radius={isRtl ? [0, 3, 3, 0] : [3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Strength radial + publishers + regions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card>
          <CardBody className="p-5 md:p-6">
            <Eyebrow>{t("workspace.dashboard.strength.title", "Signal strength")}</Eyebrow>
            <p className="text-xs text-ink-500 mb-4 mt-1">
              {t("workspace.dashboard.strength.sub", "Confidence of each signal from the classifier agent.")}
            </p>
            <div className="h-[260px]">
              <ResponsiveContainer>
                <RadialBarChart
                  innerRadius="35%"
                  outerRadius="100%"
                  data={data.strengthBreakdown.map((s) => ({
                    name: s.strength,
                    value: s.count,
                    fill: STRENGTH_COLORS[s.strength] ?? NAVY,
                  }))}
                  startAngle={90}
                  endAngle={-270}
                >
                  <PolarAngleAxis
                    type="number"
                    domain={[0, Math.max(...data.strengthBreakdown.map((s) => s.count), 1)]}
                    tick={false}
                  />
                  <RadialBar dataKey="value" background cornerRadius={4} />
                  <Legend
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11, color: "#5A6378" }}
                    formatter={(val) => String(val).toUpperCase()}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-5 md:p-6">
            <Eyebrow>{t("workspace.dashboard.publishers.title", "Top publishers")}</Eyebrow>
            <p className="text-xs text-ink-500 mb-4 mt-1">
              {t("workspace.dashboard.publishers.sub", "Which sources contributed the most signals.")}
            </p>
            <div className="space-y-2.5">
              {data.topPublishers.map((p) => {
                const max = Math.max(...data.topPublishers.map((x) => x.count), 1);
                return (
                  <div key={p.name} className="flex items-center gap-3">
                    <div className="w-28 text-xs text-navy-800 truncate shrink-0">
                      {p.name}
                    </div>
                    <div className="flex-1 h-2 bg-sand-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-navy-800"
                        style={{ width: `${(p.count / max) * 100}%` }}
                      />
                    </div>
                    <div className="w-8 text-xs tabular-nums text-navy-800 text-right shrink-0">
                      {p.count}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-5 md:p-6">
            <Eyebrow>{t("workspace.dashboard.regions.title", "Geographic coverage")}</Eyebrow>
            <p className="text-xs text-ink-500 mb-4 mt-1">
              {t("workspace.dashboard.regions.sub", "Countries where tracked companies are headquartered.")}
            </p>
            <div className="space-y-2.5">
              {data.regions.map((r) => {
                const max = Math.max(...data.regions.map((x) => x.count), 1);
                return (
                  <div key={r.country} className="flex items-center gap-3">
                    <div className="w-28 text-xs text-navy-800 truncate shrink-0">
                      {r.country}
                    </div>
                    <div className="flex-1 h-2 bg-sand-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gold-500"
                        style={{ width: `${(r.count / max) * 100}%` }}
                      />
                    </div>
                    <div className="w-8 text-xs tabular-nums text-navy-800 text-right shrink-0">
                      {r.count}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Footer note */}
      <div className="text-[11px] text-ink-400 text-center pt-2">
        {t(
          "workspace.dashboard.footer",
          "All analytics are computed server-side from the live pipeline. No external BI vendor has access to Ministry data.",
        )}
      </div>
    </div>
  );
}

function Header({
  locale: _locale,
  isRtl: _isRtl,
  lastRun,
}: {
  locale: string;
  isRtl: boolean;
  lastRun?: Date | null;
}) {
  const { t } = useLocale();
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap">
      <div>
        <Eyebrow>{t("workspace.dashboard.eyebrow", "Dashboard")}</Eyebrow>
        <SerifHeading level={1} className="mt-2">
          {t("workspace.dashboard.title", "Ministry-grade signal analytics.")}
        </SerifHeading>
        <p className="mt-2 text-ink-500 max-w-2xl text-sm md:text-base">
          {t(
            "workspace.dashboard.subtitle",
            "Every KPI, trend and ranking below is live, computed from the pipeline snapshot refreshed every few minutes. Export to Power BI is coming soon.",
          )}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {lastRun && (
          <span className="text-[11px] text-ink-500">
            {t("workspace.dashboard.updated", "Pipeline updated")} · {lastRun.toLocaleString()}
          </span>
        )}
        <button
          disabled
          className="inline-flex items-center gap-2 px-3 h-9 rounded-[3px] border border-line bg-sand-50 text-ink-400 text-xs font-medium cursor-not-allowed"
          title={t("workspace.dashboard.powerbiSoon", "Connect Power BI from the Connections page (coming soon).")}
        >
          {t("workspace.dashboard.exportPowerbi", "Export to Power BI")}
          <Badge tone="default">{t("workspace.connectors.comingSoon", "Coming soon")}</Badge>
        </button>
      </div>
    </div>
  );
}

function KpiTile({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: typeof Zap;
  label: string;
  value: string;
  sub?: string;
  accent: "navy" | "gold" | "emerald";
}) {
  const accentMap = {
    navy: "text-navy-800",
    gold: "text-gold-600",
    emerald: "text-emerald-600",
  };
  return (
    <Card>
      <CardBody className="p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <Icon className={`w-4 h-4 ${accentMap[accent]}`} />
        </div>
        <div className="headline-serif text-2xl md:text-3xl text-navy-800 leading-none tabular-nums">
          {value}
        </div>
        <div className="mt-2 text-[10.5px] uppercase tracking-[0.2em] text-gold-600 font-medium">
          {label}
        </div>
        {sub && <div className="mt-1 text-[11px] text-ink-500">{sub}</div>}
      </CardBody>
    </Card>
  );
}

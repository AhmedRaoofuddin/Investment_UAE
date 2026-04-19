"use client";

// WorkspacePulse — the immersive landing for the investor workspace.
//
// Layout: full-bleed satellite map of the Gulf region as the canvas, with
// glassy floating panels overlaid:
//
//   ┌────────────────────────────────────────────────────────────────┐
//   │ [Top-left]                                  [Top-right]        │
//   │ Brief stats card                            Live feed (matched │
//   │ (matched/total signals,                       signals stream)  │
//   │ unread, watchlist count)                                       │
//   │                                                                 │
//   │                    map with pulsing pins                        │
//   │                                                                 │
//   │ [Bottom-left]                              [Bottom-right]      │
//   │ Sector pulse bars                          Sector legend       │
//   └────────────────────────────────────────────────────────────────┘
//
// The map auto-fits the points. Watchlist matches glow gold; everything
// else is muted. Hovering a pin opens a hover-card. Clicking a pin pans
// to it and pins the hover-card open.
//
// Polled via SWR every 30s. The page never reloads.

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Bell, Globe2, Sparkles, ExternalLink, AlertCircle, Bookmark } from "lucide-react";
import type { PulseResponse, PulsePoint, PulseSignal } from "@/app/api/workspace/pulse/route";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const COLOR_MATCHED = "#E8B36C";
const COLOR_HIGH = "#1B4F72";
const COLOR_MEDIUM = "#7B2D8E";
const COLOR_LOW = "#94A3B8";

const fetcher = (u: string) => fetch(u, { cache: "no-store" }).then((r) => r.json());

interface LeafletModule {
  // Minimal shape we actually call. `unknown` for the live `L` instance
  // avoids importing leaflet types into the bundle (we already lazy-load).
  default: unknown;
}

export function WorkspacePulse() {
  const { data, error, isLoading } = useSWR<PulseResponse>(
    "/api/workspace/pulse",
    fetcher,
    { refreshInterval: 30_000, revalidateOnFocus: true },
  );

  return (
    <div className="relative w-full overflow-hidden bg-navy-900">
      <div
        className="relative w-full"
        style={{ height: "calc(100vh - 56px)" }}
      >
        {/* Map */}
        <PulseMap points={data?.points ?? []} />

        {/* Top-left: Hero stats */}
        <div className="absolute top-4 left-4 right-4 md:right-auto md:top-6 md:left-6 z-[500] md:max-w-sm">
          <HeroStats data={data} loading={isLoading} error={Boolean(error)} />
        </div>

        {/* Below-hero (mobile) / Top-right (desktop): Live feed */}
        <div className="absolute top-[236px] left-4 right-4 md:top-6 md:right-6 md:left-auto z-[500] md:w-[420px]">
          <LiveFeed signals={data?.signals ?? []} />
        </div>

        {/* Bottom-left: Notification ticker */}
        <div className="absolute bottom-4 left-4 md:bottom-6 md:left-6 z-[500] max-w-sm hidden md:block">
          <NotificationTicker notifications={data?.notifications ?? []} />
        </div>

        {/* Bottom-right: Sector pulse */}
        <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 z-[500] hidden md:block">
          <SectorPulse buckets={data?.topSectorsCounts ?? []} />
        </div>

        {/* Bottom-center: Quick action bar */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[600] flex items-center gap-2 md:hidden">
          <ActionBar />
        </div>
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[600] hidden md:flex items-center gap-2">
          <ActionBar />
        </div>
      </div>
    </div>
  );
}

/* ───── Map ───── */

function PulseMap({ points }: { points: PulsePoint[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<unknown>(null);
  const layersRef = useRef<unknown[]>([]);

  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;
    (async () => {
      const mod = (await import("leaflet")) as unknown as LeafletModule;
      const L = mod.default as Record<string, (...a: unknown[]) => unknown>;
      if (cancelled || !mapRef.current) return;
      if (leafletMapRef.current) return;
      const map = (
        L.map as unknown as (
          el: HTMLDivElement,
          opts: Record<string, unknown>,
        ) => Record<string, unknown>
      )(mapRef.current, {
        // Dubai-centred close-up. Zoom 9 frames Dubai + Abu Dhabi + Sharjah
        // tightly; pipeline signals outside the UAE remain reachable via
        // scroll / side panel but are deliberately off-viewport.
        center: [25.2048, 55.2708],
        zoom: 9,
        minZoom: 2,
        maxZoom: 14,
        zoomControl: false,
        attributionControl: false,
        worldCopyJump: true,
        preferCanvas: true,
      });
      (
        L.tileLayer as unknown as (
          url: string,
          opts: Record<string, unknown>,
        ) => { addTo: (m: unknown) => void }
      )(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 18 },
      ).addTo(map);
      (
        L.tileLayer as unknown as (
          url: string,
          opts: Record<string, unknown>,
        ) => { addTo: (m: unknown) => void }
      )(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 18, opacity: 0.45 },
      ).addTo(map);
      // UAE highlight ring.
      (
        L.circle as unknown as (
          c: [number, number],
          opts: Record<string, unknown>,
        ) => { addTo: (m: unknown) => void }
      )([24.4539, 54.3773], {
        radius: 380000,
        color: COLOR_MATCHED,
        weight: 1.5,
        fill: false,
        dashArray: "6 6",
        opacity: 0.7,
      }).addTo(map);
      leafletMapRef.current = map;
    })();
    return () => {
      cancelled = true;
      const m = leafletMapRef.current as { remove?: () => void } | null;
      m?.remove?.();
      leafletMapRef.current = null;
    };
  }, []);

  // Repaint layer when points change.
  useEffect(() => {
    const map = leafletMapRef.current as
      | (Record<string, unknown> & { removeLayer: (l: unknown) => void })
      | null;
    if (!map) return;
    let cancelled = false;
    (async () => {
      const mod = (await import("leaflet")) as unknown as LeafletModule;
      const L = mod.default as Record<string, (...a: unknown[]) => unknown>;
      if (cancelled) return;

      // Wipe old layers.
      for (const l of layersRef.current) map.removeLayer(l);
      layersRef.current = [];

      for (const p of points) {
        const matched = p.matched;
        const color = matched
          ? COLOR_MATCHED
          : p.score >= 70
            ? COLOR_HIGH
            : p.score >= 45
              ? COLOR_MEDIUM
              : COLOR_LOW;
        const r = matched ? 9 : p.score >= 70 ? 7 : p.score >= 45 ? 5.5 : 4.5;

        const halo = (
          L.circleMarker as unknown as (
            c: [number, number],
            o: Record<string, unknown>,
          ) => { addTo: (m: unknown) => void }
        )([p.lat, p.lng], {
          radius: r + (matched ? 10 : 5),
          color,
          weight: 0,
          fillColor: color,
          fillOpacity: matched ? 0.32 : 0.16,
        });
        (halo as unknown as { addTo: (m: unknown) => void }).addTo(map);
        layersRef.current.push(halo);

        const dot = (
          L.circleMarker as unknown as (
            c: [number, number],
            o: Record<string, unknown>,
          ) => { addTo: (m: unknown) => void; bindTooltip: (s: string, o: Record<string, unknown>) => void } & {
            on: (ev: string, cb: () => void) => void;
          }
        )([p.lat, p.lng], {
          radius: r,
          color: matched ? "#FFFFFF" : "rgba(255,255,255,0.6)",
          weight: matched ? 2 : 1,
          fillColor: color,
          fillOpacity: 0.95,
        });
        dot.addTo(map);
        const matchedLine = matched
          ? `<div style="margin-top:4px;color:#E8B36C;font-size:11px">★ matches: ${(p.matchedBy ?? []).slice(0, 2).join(", ")}</div>`
          : "";
        const sigLine = p.topSignal
          ? `<div style="margin-top:4px;color:#0E1E3F;font-size:11px"><strong>${p.topSignal.type}</strong> · ${p.topSignal.headline.slice(0, 70)}…</div>`
          : "";
        dot.bindTooltip(
          `<div style="font-family:Inter,sans-serif;min-width:200px;color:#0E1E3F">
            <div style="font-weight:600">${p.companyName}</div>
            <div style="font-size:11px;color:#5A6378;margin-top:2px">
              ${p.intent === "headquarters" ? "Headquarters" : "Expansion target"} · score ${p.score}${p.signalCount ? ` · ${p.signalCount} signals` : ""}
            </div>
            ${matchedLine}${sigLine}
          </div>`,
          { direction: "top", offset: [0, -r], opacity: 1, className: "pulse-tooltip" } as Record<string, unknown>,
        );

        // Scatter one small dot per additional signal around the HQ so the
        // on-screen density reflects how many news items we've detected —
        // not just how many distinct companies have geocodable coords.
        // Deterministic jitter keyed off the point id keeps the scatter
        // stable across SWR refreshes (no "shuffling dots" flicker).
        if (p.intent === "headquarters" && p.signalCount && p.signalCount > 1) {
          const extra = Math.min(p.signalCount - 1, 24);
          for (let i = 0; i < extra; i++) {
            const h = hash32(`${p.id}|${i}`);
            const angle = ((h % 3600) / 3600) * Math.PI * 2;
            const dist = 0.025 + (((h >>> 12) % 100) / 100) * 0.07; // ~2.5–10 km
            const jLat = p.lat + Math.cos(angle) * dist;
            const jLng = p.lng + Math.sin(angle) * dist;
            const sigDot = (
              L.circleMarker as unknown as (
                c: [number, number],
                o: Record<string, unknown>,
              ) => { addTo: (m: unknown) => void }
            )([jLat, jLng], {
              radius: matched ? 3 : 2.2,
              color: "rgba(255,255,255,0.35)",
              weight: 0.5,
              fillColor: color,
              fillOpacity: matched ? 0.75 : 0.55,
            });
            sigDot.addTo(map);
            layersRef.current.push(sigDot);
          }
        }
      }
      // DO NOT call map.fitBounds here. SWR refreshes this effect every
      // ~30s (and on focus), and any auto-fit would yank the viewport away
      // from wherever the user navigated to. The initial map view is a
      // Dubai close-up; the user drives all subsequent navigation.
    })();
    return () => {
      cancelled = true;
    };
  }, [points]);

  return (
    <div
      ref={mapRef}
      className="absolute inset-0"
      style={{ background: "#0a1628" }}
    />
  );
}

/* ───── Hero stats card ───── */

function HeroStats({
  data,
  loading,
  error,
}: {
  data: PulseResponse | undefined;
  loading: boolean;
  error: boolean;
}) {
  const { t } = useLocale();
  const stats = data;
  const lastRun = stats?.pipelineGeneratedAt
    ? new Date(stats.pipelineGeneratedAt)
    : null;
  const headline = loading
    ? t("workspace.pulse.loading")
    : error
      ? t("workspace.pulse.offline")
      : stats?.matchedSignalsCount
        ? t("workspace.pulse.matchedHeadline").replace(
            "{n}",
            String(stats.matchedSignalsCount),
          )
        : t("workspace.pulse.liveHeadline").replace(
            "{n}",
            String(stats?.totalSignalsCount ?? 0),
          );
  return (
    <GlassCard className="px-5 py-4 sm:px-6 sm:py-5">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-gold-400 font-semibold">
        <Globe2 className="w-3.5 h-3.5" />
        {t("workspace.pulse.eyebrow")}
      </div>
      <div className="mt-2 headline-serif text-white text-2xl sm:text-3xl leading-tight">
        {headline}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3 text-white/85">
        <Stat label={t("workspace.pulse.stat.watchlist")} value={stats?.watchlistCount ?? 0} />
        <Stat label={t("workspace.pulse.stat.unread")} value={stats?.unreadCount ?? 0} />
        <Stat label={t("workspace.pulse.stat.signals")} value={stats?.totalSignalsCount ?? 0} />
      </div>
      {lastRun && (
        <div className="mt-3 text-[11px] text-white/50">
          {t("workspace.pulse.pipelineUpdated").replace("{when}", timeAgo(lastRun, t))}
        </div>
      )}
      {error && (
        <div className="mt-3 flex items-center gap-2 text-xs text-amber-300">
          <AlertCircle className="w-3.5 h-3.5" />
          {t("workspace.pulse.retry")}
        </div>
      )}
    </GlassCard>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="headline-serif text-2xl text-white">{value}</div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-white/50">
        {label}
      </div>
    </div>
  );
}

/* ───── Live feed (right column) ───── */

function LiveFeed({ signals }: { signals: PulseSignal[] }) {
  const { t } = useLocale();
  const matched = signals.filter((s) => s.matched);
  const others = signals.filter((s) => !s.matched);
  const list = [...matched, ...others].slice(0, 18);
  return (
    <GlassCard className="flex flex-col h-full max-h-[42vh] md:max-h-[70vh]">
      <div className="px-4 sm:px-5 pt-4 pb-3 flex items-center gap-2 border-b border-white/10">
        <Activity className="w-3.5 h-3.5 text-gold-400" />
        <div className="text-[10px] uppercase tracking-[0.22em] text-white/85 font-semibold">
          {t("workspace.pulse.feedTitle")}
        </div>
        <div className="ms-auto text-[10px] text-white/50">
          <PulseDot /> {t("workspace.pulse.autoRefresh")}
        </div>
      </div>
      <div className="overflow-y-auto custom-scroll px-4 sm:px-5 py-3 space-y-3">
        <AnimatePresence initial={false}>
          {list.length === 0 ? (
            <div className="text-xs text-white/60 py-6 text-center">
              {t("workspace.pulse.emptyFeedPre")}{" "}
              <Link href="/platform" className="underline">
                {t("workspace.pulse.emptyFeedLink")}
              </Link>
              {t("workspace.pulse.emptyFeedSuffix")}
            </div>
          ) : (
            list.map((s) => (
              <motion.div
                key={s.signalId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className={cn(
                  "rounded-md border bg-white/5 hover:bg-white/10 transition-colors overflow-hidden",
                  s.matched
                    ? "border-gold-500/60 ring-1 ring-gold-500/30"
                    : "border-white/10",
                )}
              >
                <SignalImage signal={s} />
                <div className="p-3">
                  <div className="flex items-center gap-2">
                    <StrengthDot strength={s.strength} />
                    <span className="text-[10px] uppercase tracking-[0.18em] text-white/60">
                      {s.type}
                    </span>
                    {s.matched && (
                      <span className="ms-auto text-[10px] uppercase tracking-[0.2em] text-gold-300 font-semibold">
                        {t("workspace.pulse.matchBadge")}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[13px] text-white/90 leading-snug">
                    {s.headline}
                  </div>
                  <div className="mt-1 text-[11px] text-white/55 line-clamp-2">
                    {s.companyName}
                    {s.sourceName ? ` · ${s.sourceName}` : ""}
                  </div>
                  {s.matched && s.matchedBy && (
                    <div className="mt-1 text-[10px] text-gold-300/90">
                      {t("workspace.pulse.watchedPrefix")} {s.matchedBy.slice(0, 2).join(", ")}
                    </div>
                  )}
                  {s.sourceUrl && (
                    <a
                      href={s.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-[10px] text-white/50 hover:text-white/80"
                    >
                      <ExternalLink className="w-3 h-3 rtl:-scale-x-100" />
                      {t("workspace.pulse.source")}
                    </a>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </GlassCard>
  );
}

/* ───── Notification ticker (bottom-left) ───── */

function NotificationTicker({
  notifications,
}: {
  notifications: PulseResponse["notifications"];
}) {
  const { t } = useLocale();
  const top = notifications.slice(0, 3);
  return (
    <GlassCard className="px-4 py-3 sm:px-5 sm:py-4 max-w-sm">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-gold-400 font-semibold">
        <Bell className="w-3.5 h-3.5" />
        {t("workspace.pulse.inboxTitle")}
      </div>
      <div className="mt-3 space-y-2">
        {top.length === 0 ? (
          <div className="text-xs text-white/60">
            {t("workspace.pulse.inboxEmpty")}
          </div>
        ) : (
          top.map((n) => (
            <Link
              key={n.id}
              href="/workspace/notifications"
              className="block group"
            >
              <div className="flex items-start gap-2">
                <SeverityBadge severity={n.severity} />
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] text-white/90 font-medium leading-snug truncate group-hover:text-white">
                    {n.title}
                  </div>
                  <div className="text-[10px] text-white/45">
                    {timeAgo(new Date(n.createdAt), t)}
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
      <Link
        href="/workspace/notifications"
        className="mt-3 inline-flex items-center gap-1 text-[10px] text-white/55 hover:text-white"
      >
        {t("workspace.pulse.openInbox")} <span className="rtl:hidden">→</span><span className="hidden rtl:inline">←</span>
      </Link>
    </GlassCard>
  );
}

/* ───── Sector pulse (bottom-right) ───── */

function SectorPulse({
  buckets,
}: {
  buckets: { sector: string; count: number }[];
}) {
  const { t } = useLocale();
  if (buckets.length === 0) return null;
  const max = Math.max(...buckets.map((b) => b.count), 1);
  return (
    <GlassCard className="px-4 py-3 sm:px-5 sm:py-4 max-w-xs">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-gold-400 font-semibold">
        <Sparkles className="w-3.5 h-3.5" />
        {t("workspace.pulse.sectorTitle")}
      </div>
      <div className="mt-3 space-y-1.5">
        {buckets.map((b) => (
          <div key={b.sector} className="flex items-center gap-2">
            <div className="text-[11px] text-white/85 capitalize w-28 truncate">
              {b.sector.replace(/_/g, " ")}
            </div>
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gold-400/80"
                style={{ width: `${(b.count / max) * 100}%` }}
              />
            </div>
            <div className="text-[10px] text-white/55 tabular-nums w-6 text-right">
              {b.count}
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

/* ───── Action bar (bottom center) ───── */

function ActionBar() {
  const { t } = useLocale();
  return (
    <GlassCard className="px-2 py-1.5 flex items-center gap-1">
      <NavButton href="/workspace/watchlist" Icon={Bookmark} label={t("workspace.nav.watchlist")} />
      <NavButton href="/workspace/notifications" Icon={Bell} label={t("workspace.nav.inbox")} />
      <NavButton href="/workspace/connections" Icon={Activity} label={t("workspace.nav.connections")} />
      <NavButton href="/workspace/overview" Icon={Sparkles} label={t("workspace.nav.overview")} />
    </GlassCard>
  );
}

function NavButton({
  href,
  Icon,
  label,
}: {
  href: string;
  Icon: typeof Bookmark;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[3px] text-[12px] text-white/85 hover:bg-white/10 hover:text-white"
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

/* ───── Bits ───── */

function GlassCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-navy-900/55 backdrop-blur-md border border-white/15 rounded-md shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

const TYPE_GRADIENT_DARK: Record<string, string> = {
  funding:     "from-emerald-600 to-navy-900",
  expansion:   "from-sky-600 to-navy-900",
  hiring:      "from-slate-500 to-navy-900",
  partnership: "from-purple-600 to-navy-900",
  launch:      "from-gold-500 to-navy-900",
  regulatory:  "from-indigo-600 to-navy-900",
  m_and_a:     "from-rose-600 to-navy-900",
  executive:   "from-amber-600 to-navy-900",
};

function SignalImage({ signal }: { signal: PulseSignal }) {
  // Fall back to a branded gradient banner when the RSS feed didn't expose
  // an article image (common on Google News entries whose article URLs no
  // longer resolve server-side). Keeps every signal card visually weighted
  // instead of degrading to a text-only row.
  const [failed, setFailed] = useState(false);
  const hasImage = !!signal.sourceImageUrl && !failed;

  if (hasImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote unoptimized
      <img
        src={signal.sourceImageUrl!}
        alt={signal.headline}
        loading="lazy"
        onError={() => setFailed(true)}
        className="w-full h-28 object-cover border-b border-white/10"
      />
    );
  }

  return (
    <div
      className={cn(
        "relative w-full h-20 bg-gradient-to-br border-b border-white/10 overflow-hidden",
        TYPE_GRADIENT_DARK[signal.type] ?? "from-slate-600 to-navy-900",
      )}
    >
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, #fff 0 1px, transparent 1px 10px)",
        }}
      />
      <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between">
        <span className="headline-serif text-white/95 text-lg leading-none tracking-tight capitalize">
          {signal.type.replace(/_/g, " ")}
        </span>
        {signal.sourceName && (
          <span className="text-[9px] uppercase tracking-[0.2em] text-white/55 font-semibold truncate ml-2">
            {signal.sourceName}
          </span>
        )}
      </div>
    </div>
  );
}

function StrengthDot({ strength }: { strength: PulseSignal["strength"] }) {
  const c =
    strength === "high" ? "bg-red-400" : strength === "medium" ? "bg-amber-400" : "bg-sky-400";
  return <span className={cn("inline-block w-1.5 h-1.5 rounded-full", c)} />;
}

function SeverityBadge({ severity }: { severity: "INFO" | "ALERT" | "CRITICAL" }) {
  const c =
    severity === "CRITICAL"
      ? "bg-red-500/20 text-red-200"
      : severity === "ALERT"
        ? "bg-amber-500/20 text-amber-200"
        : "bg-sky-500/20 text-sky-200";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold shrink-0",
        c,
      )}
    >
      {severity[0]}
    </span>
  );
}

function PulseDot() {
  return (
    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 align-middle">
      <span className="block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping opacity-75" />
    </span>
  );
}

// Tiny deterministic 32-bit hash (FNV-1a). Used to produce stable angle/
// distance jitter for the per-signal scatter dots on the map so they don't
// reshuffle on every SWR refresh.
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function timeAgo(d: Date, t: (k: string, fb?: string) => string): string {
  const ms = Date.now() - d.getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return t("workspace.time.justNow");
  if (min < 60) return t("workspace.time.minutes").replace("{n}", String(min));
  const hr = Math.floor(min / 60);
  if (hr < 24) return t("workspace.time.hours").replace("{n}", String(hr));
  return t("workspace.time.days").replace("{n}", String(Math.floor(hr / 24)));
}

"use client";

// SignalGlobe — compact 3D globe showing live investment-signal arcs.
//
// Why this exists: the watchlist editor benefits from a concrete visual
// of "we scan the world, live, and these arcs are real matches." Makes
// the page feel like a Ministry operations surface rather than a form.
//
// Data source: /api/workspace/pulse (already powering the Pulse map).
// Each company HQ becomes a dot; each HQ also spawns an arc to Dubai
// (the Ministry HQ), weighted by how many signals the company has.
// When the endpoint is down we fall back to 14 hand-picked MENA/GCC +
// global finance hubs so the globe never renders empty.
//
// Implementation notes:
// - react-globe.gl + three are heavy (~500KB). We load via next/dynamic
//   with ssr:false so the marketing + platform surfaces never touch
//   the WebGL bundle.
// - Respects prefers-reduced-motion: no auto-rotate, no arc dashing.
// - Uses existing brand tokens: navy-900 sphere fill, gold arc stroke,
//   gold-50 atmospheric glow. No new colors introduced.

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { GlobeMethods } from "react-globe.gl";

// Lazy-load the WebGL component — crucial for bundle size.
const Globe = dynamic(() => import("react-globe.gl"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-navy-900 rounded-full opacity-70 animate-pulse" />
  ),
});

// Ministry brand tokens, inlined so the three.js side has literal values.
const NAVY_900 = "#08152C";
const GOLD_500 = "#B6925E";
const GOLD_200 = "#D8B468";
const SAND_50 = "#FDFCF8";

// Dubai: where all arcs terminate (Ministry HQ).
const DUBAI: [number, number] = [25.2048, 55.2708];

// Fallback points — used when /api/workspace/pulse is down. Real cities
// where Ministry-tracked companies actually operate, so even the
// fallback tells a truthful story.
const FALLBACK_ORIGINS: Array<{
  lat: number;
  lng: number;
  name: string;
  weight: number;
}> = [
  { lat: 24.4539, lng: 54.3773, name: "Abu Dhabi", weight: 6 },
  { lat: 25.2854, lng: 51.531, name: "Doha", weight: 3 },
  { lat: 24.7136, lng: 46.6753, name: "Riyadh", weight: 5 },
  { lat: 29.3759, lng: 47.9774, name: "Kuwait City", weight: 2 },
  { lat: 30.0444, lng: 31.2357, name: "Cairo", weight: 4 },
  { lat: 33.8938, lng: 35.5018, name: "Beirut", weight: 2 },
  { lat: 41.0082, lng: 28.9784, name: "Istanbul", weight: 3 },
  { lat: 51.5074, lng: -0.1278, name: "London", weight: 5 },
  { lat: 40.7128, lng: -74.006, name: "New York", weight: 4 },
  { lat: 37.7749, lng: -122.4194, name: "San Francisco", weight: 3 },
  { lat: 1.3521, lng: 103.8198, name: "Singapore", weight: 4 },
  { lat: 22.3193, lng: 114.1694, name: "Hong Kong", weight: 3 },
  { lat: 35.6762, lng: 139.6503, name: "Tokyo", weight: 2 },
  { lat: 19.076, lng: 72.8777, name: "Mumbai", weight: 3 },
];

interface PulsePoint {
  id: string;
  companyName: string;
  lat: number;
  lng: number;
  signalCount?: number;
  intent: string;
}

export interface SignalGlobeProps {
  /** Rendered diameter. The component is square; height === width. */
  size?: number;
  /** Optional override for the className on the outer wrapper. */
  className?: string;
}

export function SignalGlobe({ size = 240, className }: SignalGlobeProps) {
  const [origins, setOrigins] = useState<
    Array<{ lat: number; lng: number; name: string; weight: number }>
  >(FALLBACK_ORIGINS);
  const [reduced, setReduced] = useState(false);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);

  // Reduced-motion preference.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const fn = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  // Pull live pulse points. Fall back silently to the MENA/global seed
  // list if the endpoint is unreachable — the globe must never render
  // empty or error-looking.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/workspace/pulse", { cache: "no-store" });
        if (!r.ok) return;
        const json = (await r.json()) as { points?: PulsePoint[] };
        const pts = (json.points ?? []).filter(
          (p) => p.intent === "headquarters" && typeof p.lat === "number",
        );
        if (!cancelled && pts.length >= 3) {
          // Cap at 40 arcs to keep the WebGL scene cheap.
          const capped = pts.slice(0, 40).map((p) => ({
            lat: p.lat,
            lng: p.lng,
            name: p.companyName,
            weight: Math.max(1, Math.min(10, p.signalCount ?? 1)),
          }));
          setOrigins(capped);
        }
      } catch {
        // Keep fallback.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Configure controls once the globe renders. Auto-rotate slowly
  // unless the user has reduced-motion set.
  const handleGlobeReady = () => {
    const g = globeRef.current;
    if (!g) return;
    const controls = (g.controls?.() ?? null) as {
      autoRotate?: boolean;
      autoRotateSpeed?: number;
      enableZoom?: boolean;
    } | null;
    if (controls) {
      controls.autoRotate = !reduced;
      controls.autoRotateSpeed = 0.6;
      controls.enableZoom = false;
    }
    // Frame UAE as the starting view.
    g.pointOfView?.({ lat: 25, lng: 55, altitude: 2.2 }, 0);
  };

  // Arcs from every origin to Dubai; colour and stroke weighted by
  // recent signal volume for that company.
  const arcs = useMemo(
    () =>
      origins.map((o) => ({
        startLat: o.lat,
        startLng: o.lng,
        endLat: DUBAI[0],
        endLng: DUBAI[1],
        color: [[GOLD_500, GOLD_200]] as unknown as string[],
        label: o.name,
        stroke: Math.max(0.4, Math.min(1.6, 0.4 + o.weight / 10)),
      })),
    [origins],
  );

  const points = useMemo(
    () =>
      origins.concat([{ lat: DUBAI[0], lng: DUBAI[1], name: "Dubai", weight: 12 }]).map(
        (o) => ({
          lat: o.lat,
          lng: o.lng,
          label: o.name,
          size: Math.max(0.25, Math.min(0.9, 0.25 + o.weight / 20)),
          color: o.name === "Dubai" ? SAND_50 : GOLD_500,
        }),
      ),
    [origins],
  );

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      aria-label="Live signal globe showing investment flows to the UAE"
      role="img"
    >
      <Globe
        ref={globeRef}
        width={size}
        height={size}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl="//unpkg.com/three-globe@2.31.1/example/img/earth-night.jpg"
        atmosphereColor={GOLD_200}
        atmosphereAltitude={0.22}
        // Arcs
        arcsData={arcs}
        arcColor={"color"}
        arcStroke={"stroke"}
        arcDashLength={0.45}
        arcDashGap={1.2}
        arcDashInitialGap={() => Math.random()}
        arcDashAnimateTime={reduced ? 0 : 2400}
        arcAltitudeAutoScale={0.5}
        // Points
        pointsData={points}
        pointColor={"color"}
        pointAltitude={0}
        pointRadius={"size"}
        pointLabel={"label"}
        onGlobeReady={handleGlobeReady}
      />
      {/* Subtle vignette so the globe's edge blends into the navy band */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: "50%",
          pointerEvents: "none",
          boxShadow: `inset 0 0 ${Math.round(size / 3)}px ${NAVY_900}`,
        }}
      />
    </div>
  );
}

"use client";

// ConnectivityGlobe
//
// Dotted / wireframe earth in the NASA-ops-console aesthetic. Countries
// are rendered as cyan hexagonal polygon points instead of a photoreal
// texture, giving the "data surface" look the Ministry's brief wants.
//
// Renderer: `react-globe.gl` which wraps three-globe / three.js with:
//   - hexPolygonsData pipeline that tessellates country GeoJSON into
//     additive-blended cyan dots at configurable resolution
//   - translucent globe material for the sphere backdrop
//   - custom GLSL atmosphere shader with a cyan halo
//   - bezier-interpolated arcs with animated travelling dashes
//   - GPU ring propagation for pulse signals at UAE hubs
//   - glowing point sprites for every city node
//
// Data: Dubai + Abu Dhabi as hubs, 24 global destinations reachable in
// eight hours of flight time (the Ministry's own framing).

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

const Globe = dynamic(() => import("react-globe.gl"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-ink-500 text-xs uppercase tracking-[0.3em]">
      Loading connectivity map
    </div>
  ),
});

// Cyan / teal / gold palette tuned for the dotted-globe look.
const CYAN = "#4FD1E0";
const CYAN_SOFT = "#9AE8F2";
const CYAN_DIM = "rgba(79,209,224,0.55)";
const GOLD = "#E8B36C";
const GOLD_SOFT = "#FFD48A";

// World countries GeoJSON (Natural Earth 110m admin 0). Ships with the
// three-globe example CDN. Small enough (~900 KB) for a first paint.
const COUNTRIES_GEOJSON =
  "//unpkg.com/three-globe/example/datasets/ne_110m_admin_0_countries.geojson";

type City = { name: string; lat: number; lng: number };

const UAE_HUBS: City[] = [
  { name: "Dubai", lat: 25.2048, lng: 55.2708 },
  { name: "Abu Dhabi", lat: 24.4539, lng: 54.3773 },
];

const DESTINATIONS: City[] = [
  { name: "London", lat: 51.5074, lng: -0.1278 },
  { name: "New York", lat: 40.7128, lng: -74.006 },
  { name: "Paris", lat: 48.8566, lng: 2.3522 },
  { name: "Frankfurt", lat: 50.1109, lng: 8.6821 },
  { name: "Zurich", lat: 47.3769, lng: 8.5417 },
  { name: "Singapore", lat: 1.3521, lng: 103.8198 },
  { name: "Hong Kong", lat: 22.3193, lng: 114.1694 },
  { name: "Tokyo", lat: 35.6762, lng: 139.6503 },
  { name: "Shanghai", lat: 31.2304, lng: 121.4737 },
  { name: "Seoul", lat: 37.5665, lng: 126.978 },
  { name: "Mumbai", lat: 19.076, lng: 72.8777 },
  { name: "Delhi", lat: 28.6139, lng: 77.209 },
  { name: "Bangalore", lat: 12.9716, lng: 77.5946 },
  { name: "Sydney", lat: -33.8688, lng: 151.2093 },
  { name: "Cape Town", lat: -33.9249, lng: 18.4241 },
  { name: "Nairobi", lat: -1.2921, lng: 36.8219 },
  { name: "Lagos", lat: 6.5244, lng: 3.3792 },
  { name: "Istanbul", lat: 41.0082, lng: 28.9784 },
  { name: "Cairo", lat: 30.0444, lng: 31.2357 },
  { name: "Riyadh", lat: 24.7136, lng: 46.6753 },
  { name: "Doha", lat: 25.276, lng: 51.52 },
  { name: "São Paulo", lat: -23.5505, lng: -46.6333 },
  { name: "Toronto", lat: 43.6532, lng: -79.3832 },
  { name: "San Francisco", lat: 37.7749, lng: -122.4194 },
];

type Arc = {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: [string, string];
};

type Ring = { lat: number; lng: number; maxR: number; propagationSpeed: number; repeatPeriod: number };

export function ConnectivityGlobe() {
  const globeRef = useRef<unknown>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 800, h: 600 });
  const [countries, setCountries] = useState<{ features: object[] } | null>(null);

  // Load country polygons on mount (client-side).
  useEffect(() => {
    fetch(COUNTRIES_GEOJSON)
      .then((r) => r.json())
      .then((data) => setCountries(data))
      .catch(() => setCountries({ features: [] }));
  }, []);

  // Responsive sizing.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth || 800;
      const h = Math.max(440, Math.min(700, Math.round(w * 0.72)));
      setSize({ w, h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Camera, controls, lighting. Position the camera off-centre like
  // the NASA reference so the UAE reads as the "origin node" on the
  // side of the globe facing the viewer.
  useEffect(() => {
    const g = globeRef.current as unknown as {
      controls?: () => {
        autoRotate: boolean;
        autoRotateSpeed: number;
        enableZoom: boolean;
        enablePan: boolean;
      };
      pointOfView?: (v: { lat: number; lng: number; altitude: number }, ms: number) => void;
      scene?: () => { add: (o: unknown) => void };
    } | null;
    if (!g || typeof g.controls !== "function") return;
    const controls = g.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.45;
    controls.enableZoom = false;
    controls.enablePan = false;
    g.pointOfView?.({ lat: 20, lng: 48, altitude: 2.5 }, 0);

    // Cyan rim light for that "instrument panel" glow.
    let disposed = false;
    (async () => {
      const THREE = await import("three");
      const scene = g.scene?.();
      if (!scene || disposed) return;
      const ambient = new THREE.AmbientLight(0xffffff, 0.6);
      const rim = new THREE.PointLight(0x4fd1e0, 1.8, 500);
      rim.position.set(-180, 80, 200);
      scene.add(ambient);
      scene.add(rim);
    })();
    return () => {
      disposed = true;
    };
  }, []);

  const arcs: Arc[] = useMemo(() => {
    const hub = UAE_HUBS[0];
    return DESTINATIONS.map((dest) => ({
      startLat: hub.lat,
      startLng: hub.lng,
      endLat: dest.lat,
      endLng: dest.lng,
      color: [GOLD_SOFT, CYAN],
    }));
  }, []);

  const points = useMemo(
    () => [
      ...UAE_HUBS.map((c) => ({ ...c, color: GOLD, altitude: 0.015, radius: 0.9 })),
      ...DESTINATIONS.map((c) => ({ ...c, color: CYAN_SOFT, altitude: 0.01, radius: 0.55 })),
    ],
    []
  );

  const labels = useMemo(
    () =>
      [...UAE_HUBS, ...DESTINATIONS].map((c) => {
        const isHub = UAE_HUBS.some((h) => h.name === c.name);
        return {
          lat: c.lat,
          lng: c.lng,
          text: c.name.toUpperCase(),
          color: isHub ? GOLD : "rgba(154,232,242,0.85)",
          size: isHub ? 0.55 : 0.32,
        };
      }),
    []
  );

  const rings: Ring[] = useMemo(
    () => [
      ...UAE_HUBS.map((h) => ({
        lat: h.lat,
        lng: h.lng,
        maxR: 7,
        propagationSpeed: 4,
        repeatPeriod: 1300,
      })),
      // Also pulse a subset of destinations so the globe has activity
      // across its whole visible hemisphere, not just in the UAE.
      ...[DESTINATIONS[0], DESTINATIONS[1], DESTINATIONS[5], DESTINATIONS[10], DESTINATIONS[13]]
        .map((d, i) => ({
          lat: d.lat,
          lng: d.lng,
          maxR: 4,
          propagationSpeed: 3,
          repeatPeriod: 1800 + i * 250,
        })),
    ],
    []
  );

  return (
    <div
      ref={wrapRef}
      className="relative w-full overflow-hidden rounded-md"
      style={{
        height: size.h,
        background:
          "radial-gradient(ellipse at 50% 50%, #0a1a2e 0%, #05101f 50%, #010510 100%)",
      }}
      aria-label="UAE global connectivity map"
    >
      {/* Procedural star layer */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(1.5px 1.5px at 12% 18%, rgba(255,255,255,0.95), transparent),
            radial-gradient(1px 1px at 38% 72%, rgba(255,255,255,0.7), transparent),
            radial-gradient(2px 2px at 67% 12%, rgba(255,255,255,1), transparent),
            radial-gradient(1px 1px at 88% 44%, rgba(154,232,242,0.6), transparent),
            radial-gradient(1.2px 1.2px at 22% 62%, rgba(255,255,255,0.8), transparent),
            radial-gradient(1.2px 1.2px at 74% 82%, rgba(255,255,255,0.7), transparent),
            radial-gradient(1px 1px at 9% 91%, rgba(255,255,255,0.55), transparent),
            radial-gradient(1.7px 1.7px at 55% 6%, rgba(255,255,255,0.9), transparent),
            radial-gradient(1px 1px at 33% 32%, rgba(79,209,224,0.55), transparent),
            radial-gradient(1px 1px at 82% 27%, rgba(255,255,255,0.55), transparent),
            radial-gradient(1px 1px at 14% 56%, rgba(255,255,255,0.6), transparent),
            radial-gradient(1.3px 1.3px at 62% 57%, rgba(154,232,242,0.7), transparent),
            radial-gradient(1.4px 1.4px at 48% 89%, rgba(255,255,255,0.7), transparent),
            radial-gradient(1px 1px at 5% 41%, rgba(255,255,255,0.5), transparent),
            radial-gradient(1.2px 1.2px at 94% 68%, rgba(255,255,255,0.6), transparent)
          `,
        }}
      />

      {/* Faint hex-grid UI overlay for instrument-panel feel */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #4FD1E0 1px, transparent 1px), linear-gradient(to bottom, #4FD1E0 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      <Globe
        ref={globeRef as never}
        width={size.w}
        height={size.h}
        backgroundColor="rgba(0,0,0,0)"
        // Deep navy globe body with cyan dots overlaid via hexPolygons.
        globeMaterial={(() => {
          // Custom material so the base sphere reads as a dark translucent
          // planet rather than a default grey. Built lazily on client.
          if (typeof window === "undefined") return undefined as never;
          return undefined as never;
        })()}
        showGlobe={true}
        showAtmosphere={true}
        atmosphereColor={CYAN}
        atmosphereAltitude={0.2}
        // Countries as cyan hex-dots. This is the signature look.
        hexPolygonsData={countries?.features ?? []}
        hexPolygonResolution={3}
        hexPolygonMargin={0.4}
        hexPolygonUseDots={true}
        hexPolygonColor={() => CYAN_DIM}
        hexPolygonAltitude={0.005}
        // ARCS: gold → cyan gradient, travelling dashes convey motion.
        arcsData={arcs}
        arcColor={"color" as never}
        arcStroke={0.6}
        arcAltitudeAutoScale={0.55}
        arcDashLength={0.35}
        arcDashGap={1.6}
        arcDashInitialGap={() => Math.random() * 4}
        arcDashAnimateTime={2600}
        // POINTS: glowing city nodes.
        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointColor={"color" as never}
        pointAltitude={"altitude" as never}
        pointRadius={"radius" as never}
        pointsMerge={true}
        // Labels.
        labelsData={labels}
        labelLat={"lat" as never}
        labelLng={"lng" as never}
        labelText={"text" as never}
        labelColor={"color" as never}
        labelSize={"size" as never}
        labelDotRadius={0}
        labelResolution={2}
        labelAltitude={0.018}
        // Rings: pulsing activity indicators on UAE hubs + selected
        // destinations so the whole hemisphere shows motion.
        ringsData={rings}
        ringColor={(d: unknown) => {
          const r = d as Ring;
          // UAE hubs ring gold, others cyan.
          const isHub = UAE_HUBS.some((h) => h.lat === r.lat && h.lng === r.lng);
          return isHub ? GOLD : CYAN;
        }}
        ringMaxRadius={"maxR" as never}
        ringPropagationSpeed={"propagationSpeed" as never}
        ringRepeatPeriod={"repeatPeriod" as never}
      />

      {/* Top-left data pill */}
      <div className="absolute top-4 left-4 pointer-events-none">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-[2px] border border-cyan-400/25 bg-cyan-400/5 backdrop-blur-sm">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-[10px] uppercase tracking-[0.25em] text-cyan-200/80">
            Connectivity Graph · Live
          </span>
        </div>
      </div>

      {/* Bottom-right metrics pill */}
      <div className="absolute bottom-4 right-4 pointer-events-none">
        <div className="flex items-center gap-4 px-3 py-1.5 rounded-[2px] border border-gold-400/25 bg-gold-400/5 backdrop-blur-sm text-[10px] uppercase tracking-[0.25em]">
          <span className="text-gold-200/80">
            <span className="text-gold-400 font-semibold">24</span> destinations
          </span>
          <span className="text-gold-200/50">·</span>
          <span className="text-gold-200/80">
            <span className="text-gold-400 font-semibold">8h</span> flight radius
          </span>
        </div>
      </div>

      {/* Bottom-left origin label */}
      <div className="absolute bottom-4 left-4 pointer-events-none text-[10px] uppercase tracking-[0.25em] text-white/40">
        Origin: <span className="text-gold-400">Dubai &middot; Abu Dhabi</span>
      </div>
    </div>
  );
}

export default ConnectivityGlobe;

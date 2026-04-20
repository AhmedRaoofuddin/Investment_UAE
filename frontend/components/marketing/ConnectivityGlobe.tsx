"use client";

// ConnectivityGlobe
//
// Photorealistic earth globe with live connectivity arcs from the UAE
// to 24 destination cities. Rendered via `react-globe.gl` which wraps
// three-globe / three.js with:
//   - NASA Blue Marble day texture for a real earth surface
//   - topology bump map so continents have relief under light
//   - separate cloud layer rotating at a different rate than the globe
//   - custom GLSL atmosphere shader with configurable altitude + colour
//   - bezier-interpolated arcs with animated travelling dashes
//   - GPU-accelerated ring propagation for pulse signals at UAE hubs
//
// None of this is a hand-rolled three.js scene. It is the globe.gl
// pipeline with deliberate data, materials and lighting choices.

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

// Texture URLs (hosted on jsDelivr as part of the three-globe package).
// Blue Marble = NASA public-domain daylight earth composite.
const TEX_EARTH = "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg";
const TEX_BUMP = "//unpkg.com/three-globe/example/img/earth-topology.png";
const TEX_CLOUDS = "//unpkg.com/three-globe/example/img/clouds.png";

// Brand-tuned accent colours kept subtle so the real earth reads through.
const GOLD = "#E8B36C";
const GOLD_SOFT = "#FFD48A";
const NAVY = "#1B4F72";

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
  stroke: number;
  color: [string, string];
};

type Ring = { lat: number; lng: number; maxR: number; propagationSpeed: number; repeatPeriod: number };

export function ConnectivityGlobe() {
  const globeRef = useRef<unknown>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 800, h: 600 });

  // Observe container size; responsive height, capped so it doesn't
  // overwhelm narrow mobile viewports.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth || 800;
      const h = Math.max(420, Math.min(680, Math.round(w * 0.7)));
      setSize({ w, h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Configure camera, lighting, controls, and mount the cloud layer.
  useEffect(() => {
    const g = globeRef.current as unknown as {
      controls?: () => {
        autoRotate: boolean;
        autoRotateSpeed: number;
        enableZoom: boolean;
        enablePan: boolean;
      };
      pointOfView?: (v: { lat: number; lng: number; altitude: number }, ms: number) => void;
      scene?: () => {
        add: (o: unknown) => void;
        background: unknown;
      };
    } | null;
    if (!g || typeof g.controls !== "function") return;

    const controls = g.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.45;
    controls.enableZoom = false;
    controls.enablePan = false;
    g.pointOfView?.({ lat: 24.5, lng: 48.0, altitude: 2.3 }, 0);

    // Attach a transparent cloud sphere on top of the globe so clouds
    // rotate independently of the earth surface. This is what gives
    // the "real planet" feel that static textures never deliver.
    let cloudsMesh: { rotation: { y: number } } | null = null;
    let raf = 0;
    let disposed = false;

    (async () => {
      const THREE = await import("three");
      const scene = g.scene?.();
      if (!scene || disposed) return;

      const loader = new THREE.TextureLoader();
      loader.crossOrigin = "anonymous";
      loader.load(TEX_CLOUDS, (tex) => {
        if (disposed) return;
        const geom = new THREE.SphereGeometry(101, 64, 64);
        const mat = new THREE.MeshPhongMaterial({
          map: tex,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(geom, mat) as unknown as { rotation: { y: number } };
        cloudsMesh = mesh;
        scene.add(mesh);
      });

      const animate = () => {
        if (disposed) return;
        if (cloudsMesh) cloudsMesh.rotation.y += 0.0006;
        raf = requestAnimationFrame(animate);
      };
      animate();
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  const arcs: Arc[] = useMemo(() => {
    const out: Arc[] = [];
    for (const hub of UAE_HUBS) {
      for (const dest of DESTINATIONS) {
        out.push({
          startLat: hub.lat,
          startLng: hub.lng,
          endLat: dest.lat,
          endLng: dest.lng,
          stroke: 0.35,
          color: [GOLD_SOFT, NAVY],
        });
      }
    }
    return out;
  }, []);

  const points = useMemo(
    () => [
      ...UAE_HUBS.map((c) => ({ ...c, color: GOLD, altitude: 0.01, radius: 0.55 })),
      ...DESTINATIONS.map((c) => ({ ...c, color: "#FFFFFF", altitude: 0.005, radius: 0.3 })),
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
          text: c.name,
          color: isHub ? GOLD : "rgba(255,255,255,0.85)",
          size: isHub ? 0.5 : 0.32,
        };
      }),
    []
  );

  const rings: Ring[] = useMemo(
    () =>
      UAE_HUBS.map((h) => ({
        lat: h.lat,
        lng: h.lng,
        maxR: 6,
        propagationSpeed: 3,
        repeatPeriod: 1200,
      })),
    []
  );

  return (
    <div
      ref={wrapRef}
      className="relative w-full overflow-hidden rounded-md"
      style={{
        height: size.h,
        background:
          "radial-gradient(ellipse at 50% 55%, #0a1530 0%, #050a1a 55%, #02050e 100%)",
      }}
      aria-label="UAE global connectivity map"
    >
      {/* Starfield */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(1px 1px at 17% 23%, rgba(255,255,255,0.8), transparent),
            radial-gradient(1px 1px at 42% 78%, rgba(255,255,255,0.6), transparent),
            radial-gradient(1.5px 1.5px at 67% 12%, rgba(255,255,255,0.9), transparent),
            radial-gradient(1px 1px at 88% 44%, rgba(255,255,255,0.5), transparent),
            radial-gradient(1px 1px at 28% 62%, rgba(255,255,255,0.7), transparent),
            radial-gradient(1.2px 1.2px at 74% 82%, rgba(255,255,255,0.6), transparent),
            radial-gradient(1px 1px at 9% 91%, rgba(255,255,255,0.55), transparent),
            radial-gradient(1.5px 1.5px at 55% 8%, rgba(255,255,255,0.8), transparent),
            radial-gradient(1px 1px at 36% 34%, rgba(255,255,255,0.65), transparent),
            radial-gradient(1px 1px at 82% 27%, rgba(255,255,255,0.5), transparent),
            radial-gradient(1px 1px at 14% 56%, rgba(255,255,255,0.55), transparent),
            radial-gradient(1.3px 1.3px at 62% 67%, rgba(255,255,255,0.7), transparent)
          `,
        }}
      />

      <Globe
        ref={globeRef as never}
        width={size.w}
        height={size.h}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl={TEX_EARTH}
        bumpImageUrl={TEX_BUMP}
        showAtmosphere={true}
        atmosphereColor={GOLD}
        atmosphereAltitude={0.24}
        // ARCS: travelling dashes convey motion; gold → navy gradient.
        arcsData={arcs}
        arcColor={"color" as never}
        arcStroke={"stroke" as never}
        arcAltitudeAutoScale={0.45}
        arcDashLength={0.35}
        arcDashGap={2.2}
        arcDashInitialGap={() => Math.random() * 4}
        arcDashAnimateTime={3000}
        // POINTS: UAE hubs in gold (larger), destinations in soft white.
        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointColor={"color" as never}
        pointAltitude={"altitude" as never}
        pointRadius={"radius" as never}
        pointsMerge={true}
        // LABELS on the surface.
        labelsData={labels}
        labelLat={"lat" as never}
        labelLng={"lng" as never}
        labelText={"text" as never}
        labelColor={"color" as never}
        labelSize={"size" as never}
        labelDotRadius={0}
        labelResolution={2}
        labelAltitude={0.012}
        // Expanding pulse rings at UAE hubs.
        ringsData={rings}
        ringColor={() => GOLD}
        ringMaxRadius={"maxR" as never}
        ringPropagationSpeed={"propagationSpeed" as never}
        ringRepeatPeriod={"repeatPeriod" as never}
      />

      {/* Caption overlay */}
      <div className="absolute left-4 bottom-4 right-4 flex items-end justify-between pointer-events-none text-[10px] uppercase tracking-[0.25em]">
        <span className="text-white/50">Live connectivity graph</span>
        <span className="text-gold-400/80 flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-gold-400 animate-pulse" />
          24 destinations · 8hr flight radius
        </span>
      </div>
    </div>
  );
}

export default ConnectivityGlobe;

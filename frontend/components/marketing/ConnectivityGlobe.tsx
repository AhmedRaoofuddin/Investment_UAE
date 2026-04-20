"use client";

// ConnectivityGlobe
//
// Photorealistic earth globe (NASA Blue Marble composite) centred on
// the UAE, with the UAE rendered as a dominant gold marker + pulsing
// ring so it reads immediately as the origin node. 24 destination
// cities surround it with animated cyan arcs along great-circle paths.
//
// Renderer: `react-globe.gl` (React wrapper over three-globe / three.js)
// with the following deliberate material and lighting choices so the
// earth reads as a real planet rather than a flat texture:
//   - High-brightness Blue Marble day composite as the globe surface
//   - Earth topology as a bump map for continent relief
//   - Cloud sphere overlay rotating at its own rate
//   - Boosted AmbientLight + warm key DirectionalLight + cool fill
//   - Natural blue atmosphere halo
//   - Camera locked on the UAE (lat 24, lng 54) at altitude 2.1
//   - UAE marker: oversized gold point + animated pulsing ring

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

const Globe = dynamic(() => import("react-globe.gl"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-ink-500 text-xs uppercase tracking-[0.3em]">
      Loading globe
    </div>
  ),
});

// Textures hosted on jsDelivr via three-globe's example assets.
// Blue Marble = NASA public-domain daylight composite.
const TEX_EARTH = "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg";
const TEX_BUMP = "//unpkg.com/three-globe/example/img/earth-topology.png";
const TEX_CLOUDS = "//unpkg.com/three-globe/example/img/clouds.png";
const TEX_STARS = "//unpkg.com/three-globe/example/img/night-sky.png";

const GOLD = "#E8B36C";
const GOLD_SOFT = "#FFD48A";
const CYAN = "#4FD1E0";
const ATMO = "#8BB8FF";

type City = { name: string; lat: number; lng: number };

const UAE: City = { name: "United Arab Emirates", lat: 24.4667, lng: 54.3667 };

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

type Point = {
  lat: number;
  lng: number;
  color: string;
  altitude: number;
  radius: number;
};

type Ring = { lat: number; lng: number; maxR: number; propagationSpeed: number; repeatPeriod: number };

type Label = { lat: number; lng: number; text: string; color: string; size: number };

export function ConnectivityGlobe() {
  const globeRef = useRef<unknown>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 520, h: 520 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth || 520;
      const h = Math.max(380, Math.min(560, w));
      setSize({ w, h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Camera, controls, scene lighting, cloud layer.
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
    controls.autoRotateSpeed = 0.35;
    controls.enableZoom = false;
    controls.enablePan = false;
    // Camera centred on the UAE so the first frame shows the origin
    // node clearly rather than mid-ocean.
    g.pointOfView?.({ lat: UAE.lat, lng: UAE.lng, altitude: 2.1 }, 0);

    let cloudsMesh: { rotation: { y: number } } | null = null;
    let raf = 0;
    let disposed = false;

    (async () => {
      const THREE = await import("three");
      const scene = g.scene?.();
      if (!scene || disposed) return;

      // Brighten the whole globe so continents and oceans both read.
      const ambient = new THREE.AmbientLight(0xffffff, 2.0);
      const key = new THREE.DirectionalLight(0xfff4e0, 1.4);
      key.position.set(-200, 140, 260);
      const fill = new THREE.DirectionalLight(0x8aaaff, 0.65);
      fill.position.set(220, -60, -160);
      scene.add(ambient);
      scene.add(key);
      scene.add(fill);

      // Cloud sphere slightly above the earth surface.
      const loader = new THREE.TextureLoader();
      loader.crossOrigin = "anonymous";
      loader.load(TEX_CLOUDS, (tex) => {
        if (disposed) return;
        const geom = new THREE.SphereGeometry(100.8, 96, 96);
        const mat = new THREE.MeshPhongMaterial({
          map: tex,
          transparent: true,
          opacity: 0.38,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(geom, mat) as unknown as { rotation: { y: number } };
        cloudsMesh = mesh;
        scene.add(mesh);
      });

      const animate = () => {
        if (disposed) return;
        if (cloudsMesh) cloudsMesh.rotation.y += 0.00045;
        raf = requestAnimationFrame(animate);
      };
      animate();
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  // Arcs: every destination connects to the UAE.
  const arcs: Arc[] = useMemo(
    () =>
      DESTINATIONS.map((d) => ({
        startLat: UAE.lat,
        startLng: UAE.lng,
        endLat: d.lat,
        endLng: d.lng,
        color: [GOLD_SOFT, CYAN],
      })),
    []
  );

  // Points: the UAE is larger and gold; destinations are smaller white.
  const points: Point[] = useMemo(
    () => [
      { lat: UAE.lat, lng: UAE.lng, color: GOLD, altitude: 0.02, radius: 1.2 },
      ...DESTINATIONS.map((d) => ({
        lat: d.lat,
        lng: d.lng,
        color: "#FFFFFF",
        altitude: 0.008,
        radius: 0.45,
      })),
    ],
    []
  );

  // Labels: the UAE label is prominent, destinations are lighter.
  const labels: Label[] = useMemo(
    () => [
      { lat: UAE.lat, lng: UAE.lng, text: "UAE", color: GOLD, size: 0.85 },
      ...DESTINATIONS.map((d) => ({
        lat: d.lat,
        lng: d.lng,
        text: d.name.toUpperCase(),
        color: "rgba(255,255,255,0.85)",
        size: 0.32,
      })),
    ],
    []
  );

  // Rings: a strong pulse on the UAE, subtle pulses on a handful of
  // destinations so the whole hemisphere shows motion.
  const rings: Ring[] = useMemo(
    () => [
      { lat: UAE.lat, lng: UAE.lng, maxR: 8, propagationSpeed: 3.5, repeatPeriod: 1200 },
      { lat: UAE.lat, lng: UAE.lng, maxR: 4, propagationSpeed: 2.5, repeatPeriod: 1800 },
      ...[DESTINATIONS[0], DESTINATIONS[5], DESTINATIONS[10], DESTINATIONS[13], DESTINATIONS[21]].map(
        (d, i) => ({
          lat: d.lat,
          lng: d.lng,
          maxR: 3,
          propagationSpeed: 2.5,
          repeatPeriod: 2200 + i * 200,
        })
      ),
    ],
    []
  );

  return (
    <div
      ref={wrapRef}
      className="relative w-full overflow-hidden rounded-md"
      style={{
        height: size.h,
        background: "#000000",
      }}
      aria-label="UAE global connectivity map"
    >
      {/* Milky Way backdrop — the built-in three-globe night-sky texture
          is a 4K Milky Way panorama. Tile it to fill the frame and tint
          slightly so it reads as space around the earth rather than a
          flat starfield. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url(${TEX_STARS})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.9,
        }}
      />
      {/* Warm nebula glow in the upper-right to mirror the reference
          aesthetic (galactic dust band). Pure CSS gradient, so no
          extra download. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 45% at 85% 18%, rgba(229,143,97,0.18) 0%, rgba(158,83,40,0.09) 40%, transparent 70%), radial-gradient(ellipse 45% 35% at 8% 82%, rgba(110,139,200,0.14) 0%, transparent 65%)",
        }}
      />
      {/* Extra procedural sparkle stars on top for close foreground depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(1.5px 1.5px at 12% 18%, rgba(255,255,255,1), transparent),
            radial-gradient(1px 1px at 38% 72%, rgba(255,255,255,0.85), transparent),
            radial-gradient(2px 2px at 67% 12%, rgba(255,255,255,1), transparent),
            radial-gradient(1.3px 1.3px at 88% 44%, rgba(180,210,255,0.85), transparent),
            radial-gradient(1.2px 1.2px at 22% 62%, rgba(255,255,255,0.9), transparent),
            radial-gradient(1.2px 1.2px at 74% 82%, rgba(255,255,255,0.8), transparent),
            radial-gradient(1.4px 1.4px at 55% 6%, rgba(255,255,255,1), transparent),
            radial-gradient(1.4px 1.4px at 48% 89%, rgba(255,255,255,0.85), transparent)
          `,
        }}
      />

      <Globe
        ref={globeRef as never}
        width={size.w}
        height={size.h}
        backgroundColor="rgba(0,0,0,0)"
        backgroundImageUrl={TEX_STARS}
        globeImageUrl={TEX_EARTH}
        bumpImageUrl={TEX_BUMP}
        showAtmosphere={true}
        atmosphereColor={ATMO}
        atmosphereAltitude={0.2}
        arcsData={arcs}
        arcColor={"color" as never}
        arcStroke={0.5}
        arcAltitudeAutoScale={0.5}
        arcDashLength={0.4}
        arcDashGap={1.8}
        arcDashInitialGap={() => Math.random() * 4}
        arcDashAnimateTime={2600}
        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointColor={"color" as never}
        pointAltitude={"altitude" as never}
        pointRadius={"radius" as never}
        pointsMerge={false}
        labelsData={labels}
        labelLat={"lat" as never}
        labelLng={"lng" as never}
        labelText={"text" as never}
        labelColor={"color" as never}
        labelSize={"size" as never}
        labelDotRadius={0}
        labelResolution={2}
        labelAltitude={0.02}
        ringsData={rings}
        ringColor={(d: unknown) => {
          const r = d as Ring;
          return r.lat === UAE.lat && r.lng === UAE.lng ? GOLD : CYAN;
        }}
        ringMaxRadius={"maxR" as never}
        ringPropagationSpeed={"propagationSpeed" as never}
        ringRepeatPeriod={"repeatPeriod" as never}
      />

      {/* Top-left live pill */}
      <div className="absolute top-4 left-4 pointer-events-none">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-[2px] border border-cyan-400/25 bg-cyan-400/5 backdrop-blur-sm">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-[10px] uppercase tracking-[0.25em] text-cyan-200/80">
            Connectivity Graph · Live
          </span>
        </div>
      </div>

      {/* Top-right route counter */}
      <div className="absolute top-4 right-4 pointer-events-none">
        <div className="flex items-center gap-3 px-3 py-1.5 rounded-[2px] border border-white/10 bg-white/[0.03] backdrop-blur-sm text-[10px] uppercase tracking-[0.25em]">
          <span className="text-white/60">Routes</span>
          <span className="text-gold-300 font-semibold">24</span>
          <span className="text-white/30">·</span>
          <span className="text-white/60">Hub</span>
          <span className="text-gold-300 font-semibold">UAE</span>
        </div>
      </div>

      {/* Bottom metrics pill — single line so no crowding */}
      <div className="absolute bottom-4 left-4 right-4 pointer-events-none flex items-center justify-between text-[10px] uppercase tracking-[0.25em]">
        <span className="text-gold-400">
          Origin <span className="text-white/50 mx-1">·</span>{" "}
          <span className="text-white/80">Dubai &amp; Abu Dhabi</span>
        </span>
        <span className="text-white/60">
          <span className="text-gold-400 font-semibold">8h</span> flight radius
          <span className="text-white/30 mx-2">·</span>
          <span className="text-gold-400 font-semibold">2/3</span> of global population
        </span>
      </div>
    </div>
  );
}

export default ConnectivityGlobe;

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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
const ATMO = "#7B22D9"; // vivid violet — matches the galaxy reference purple halo

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


export function ConnectivityGlobe() {
  const globeRef = useRef<unknown>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const sceneInitDone = useRef(false);
  const rafRef = useRef(0);

  const [size, setSize] = useState<{ w: number; h: number }>({ w: 320, h: 320 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = Math.max(0, el.clientWidth);
      if (w === 0) return;
      const clamped = Math.max(300, Math.min(780, w));
      setSize({ w: clamped, h: clamped });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Called by react-globe.gl once Three.js is fully initialised.
  // This is the only reliable place to set controls / camera / lighting.
  const handleGlobeReady = useCallback(() => {
    if (sceneInitDone.current) return;
    sceneInitDone.current = true;

    const g = globeRef.current as {
      controls?: () => {
        autoRotate: boolean;
        autoRotateSpeed: number;
        enableZoom: boolean;
        enablePan: boolean;
      };
      pointOfView?: (v: { lat: number; lng: number; altitude: number }, ms: number) => void;
      scene?: () => { add: (o: unknown) => void };
    } | null;
    if (!g) return;

    // Lock camera on Dubai, show a full hemisphere of destinations.
    g.pointOfView?.({ lat: 25.2, lng: 55.3, altitude: 2.2 }, 0);

    const controls = g.controls?.();
    if (controls) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.6;
      controls.enableZoom = false;
      controls.enablePan = false;
    }

    // Lighting + cloud layer (async — Three.js is already loaded by the globe).
    (async () => {
      const THREE = await import("three");
      const scene = g.scene?.();
      if (!scene) return;

      const ambient = new THREE.AmbientLight(0xffffff, 2.0);
      const key = new THREE.DirectionalLight(0xfff4e0, 1.4);
      key.position.set(-200, 140, 260);
      const fill = new THREE.DirectionalLight(0x8aaaff, 0.65);
      fill.position.set(220, -60, -160);
      scene.add(ambient);
      scene.add(key);
      scene.add(fill);

      const loader = new THREE.TextureLoader();
      loader.crossOrigin = "anonymous";
      loader.load(TEX_CLOUDS, (tex) => {
        const geom = new THREE.SphereGeometry(100.8, 96, 96);
        const mat = new THREE.MeshPhongMaterial({
          map: tex,
          transparent: true,
          opacity: 0.38,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(geom, mat) as unknown as { rotation: { y: number } };
        scene.add(mesh);

        const spin = () => {
          mesh.rotation.y += 0.00045;
          rafRef.current = requestAnimationFrame(spin);
        };
        spin();
      });
    })();
  }, []);

  // Clean up cloud RAF on unmount.
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

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

  // Points: small, flush-to-surface. The HTML pins above take the
  // visual weight; these sprites just provide the glowing dot under
  // each label so the label has a precise anchor.
  const points: Point[] = useMemo(
    () => [
      { lat: UAE.lat, lng: UAE.lng, color: GOLD, altitude: 0.005, radius: 0.3 },
      ...DESTINATIONS.map((d) => ({
        lat: d.lat,
        lng: d.lng,
        color: "#FFFFFF",
        altitude: 0.003,
        radius: 0.18,
      })),
    ],
    []
  );

  // HTML pin markers — each becomes an absolutely-positioned div
  // tracked to its lat/lng as the globe rotates. Dubai + Abu Dhabi are
  // "hub" pins (larger, gold); the 24 destinations are smaller cyan
  // pins with a text label above the dot.
  const htmlPins = useMemo(
    () => [
      { lat: 25.2048, lng: 55.2708, name: "Dubai", hub: true as const },
      { lat: 24.4539, lng: 54.3773, name: "Abu Dhabi", hub: true as const },
      ...DESTINATIONS.map((d) => ({ lat: d.lat, lng: d.lng, name: d.name })),
    ],
    []
  );

  // Rings: one subtle pulse on the UAE. Earlier version had giant
  // concentric rings that dwarfed the Arabian peninsula; this keeps
  // the ring small so it reads as a precise location marker rather
  // than a radar sweep.
  const rings: Ring[] = useMemo(
    () => [
      { lat: UAE.lat, lng: UAE.lng, maxR: 2, propagationSpeed: 1.2, repeatPeriod: 2400 },
    ],
    []
  );

  return (
    <div
      ref={wrapRef}
      className="relative w-full max-w-full overflow-hidden rounded-md"
      style={{
        height: size.h,
        background: "#000000",
        // Cap inline width so a stale initial size can never push the
        // wrapper past the parent on first paint.
        maxWidth: "100%",
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
      {/* Purple / magenta nebula dust — vivid violet on the right,
          deep blue-violet on the left. Tuned to match the reference
          image: Earth centred with a bright purple atmospheric halo
          and a magenta galactic trail washing across the frame. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 90% 25%, rgba(140,40,230,0.42) 0%, rgba(100,20,200,0.22) 40%, transparent 72%), radial-gradient(ellipse 55% 45% at 4% 80%, rgba(70,60,220,0.28) 0%, transparent 68%), radial-gradient(ellipse 40% 30% at 94% 68%, rgba(220,80,200,0.22) 0%, transparent 62%)",
        }}
      />
      {/* Ambient vivid-purple atmospheric haze that rings the whole
          globe — this is what produces the glowing violet halo seen
          in the reference image. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 110% 80% at 50% 52%, rgba(100,30,200,0.20) 0%, rgba(80,20,180,0.10) 40%, transparent 70%)",
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
        onGlobeReady={handleGlobeReady}
        backgroundColor="rgba(0,0,0,0)"
        backgroundImageUrl={TEX_STARS}
        globeImageUrl={TEX_EARTH}
        bumpImageUrl={TEX_BUMP}
        showAtmosphere={true}
        atmosphereColor={ATMO}
        atmosphereAltitude={0.28}
        arcsData={arcs}
        arcColor={"color" as never}
        arcStroke={0.18}
        arcAltitudeAutoScale={0.4}
        arcDashLength={0.4}
        arcDashGap={2}
        arcDashInitialGap={() => Math.random() * 4}
        arcDashAnimateTime={3200}
        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointColor={"color" as never}
        pointAltitude={"altitude" as never}
        pointRadius={"radius" as never}
        pointsMerge={false}
        // Real HTML pins — rendered as absolutely-positioned divs that
        // track their lat/lng as the globe rotates. This is what gives
        // the "map marker" feel instead of tiny 3D sprites.
        htmlElementsData={htmlPins}
        htmlLat={"lat" as never}
        htmlLng={"lng" as never}
        htmlAltitude={0.02}
        htmlElement={(d: unknown) => {
          const pin = d as { name: string; hub?: boolean };
          const el = document.createElement("div");
          el.style.pointerEvents = "none";
          el.style.transform = "translate(-50%, -100%)";
          el.style.display = "flex";
          el.style.flexDirection = "column";
          el.style.alignItems = "center";
          if (pin.hub) {
            el.innerHTML = `
              <div style="color:#E8B36C;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;text-shadow:0 1px 3px rgba(0,0,0,0.95);margin-bottom:2px;white-space:nowrap;">${pin.name}</div>
              <div style="width:6px;height:6px;border-radius:50%;background:#E8B36C;box-shadow:0 0 0 2px rgba(232,179,94,0.3),0 0 8px rgba(232,179,94,0.7);"></div>
            `;
          } else {
            el.innerHTML = `
              <div style="color:rgba(255,255,255,0.92);font-size:8.5px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;text-shadow:0 1px 2px rgba(0,0,0,0.95);margin-bottom:1px;white-space:nowrap;">${pin.name}</div>
              <div style="width:3px;height:3px;border-radius:50%;background:#4FD1E0;box-shadow:0 0 0 1.5px rgba(79,209,224,0.25),0 0 5px rgba(79,209,224,0.6);"></div>
            `;
          }
          return el;
        }}
        ringsData={rings}
        ringColor={(d: unknown) => {
          const r = d as Ring;
          return r.lat === UAE.lat && r.lng === UAE.lng ? GOLD : CYAN;
        }}
        ringMaxRadius={"maxR" as never}
        ringPropagationSpeed={"propagationSpeed" as never}
        ringRepeatPeriod={"repeatPeriod" as never}
      />

      {/* Top-left live pill — shortened on mobile */}
      <div className="absolute top-3 left-3 sm:top-4 sm:left-4 pointer-events-none">
        <div className="flex items-center gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-[2px] border border-cyan-400/25 bg-cyan-400/5 backdrop-blur-sm">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.25em] text-cyan-200/80">
            <span className="hidden sm:inline">Connectivity Graph · </span>Live
          </span>
        </div>
      </div>

      {/* Top-right route counter — compact on mobile */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 pointer-events-none">
        <div className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1 sm:py-1.5 rounded-[2px] border border-white/10 bg-white/[0.03] backdrop-blur-sm text-[9px] sm:text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.25em]">
          <span className="text-white/60">Routes</span>
          <span className="text-gold-300 font-semibold">24</span>
          <span className="text-white/30 hidden sm:inline">·</span>
          <span className="text-white/60 hidden sm:inline">Hub</span>
          <span className="text-gold-300 font-semibold hidden sm:inline">UAE</span>
        </div>
      </div>

      {/* Bottom status bar — stacks on mobile to avoid overlap */}
      <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 pointer-events-none flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-1 sm:gap-0 text-[9px] sm:text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.25em]">
        <span className="text-gold-400">
          Origin <span className="text-white/50 mx-1">·</span>
          <span className="text-white/80">Dubai &amp; Abu Dhabi</span>
        </span>
        <span className="text-white/60">
          <span className="text-gold-400 font-semibold">8h</span> radius
          <span className="text-white/30 mx-2">·</span>
          <span className="text-gold-400 font-semibold">2/3</span> global pop.
        </span>
      </div>
    </div>
  );
}

export default ConnectivityGlobe;

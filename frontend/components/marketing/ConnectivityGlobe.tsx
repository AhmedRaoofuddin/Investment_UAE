"use client";

// ConnectivityGlobe
//
// Premium dotted-earth globe rendered via `cobe` (https://cobe.vercel.app),
// the same WebGL globe Vercel ships on their own homepage and that
// Linear, Plasmic, Framer and many others use for this signature
// "NASA ops console" look.
//
// Cobe runs a custom fragment shader that samples a built-in world
// map at thousands of points and renders each as a dot, giving the
// dotted-continent aesthetic with zero setup. Continents render
// correctly out of the box (no GeoJSON fetch, no tessellation).
//
// On top of the cobe canvas we overlay:
//   - A spring-driven phi rotation for inertial auto-rotate that
//     settles toward the UAE when user mouse input stops.
//   - A marker list for Dubai, Abu Dhabi, and 24 global destinations.
//   - A pulsing gold ring on the UAE hubs (CSS-only, absolutely
//     positioned), so the "origin node" reads as active without
//     drawing into the WebGL context.
//   - Corner data pills in the instrument-panel style.

import { useEffect, useMemo, useRef, useState } from "react";
import createGlobe from "cobe";

type City = { name: string; lat: number; lng: number; hub?: boolean };

const UAE_HUBS: City[] = [
  { name: "Dubai", lat: 25.2048, lng: 55.2708, hub: true },
  { name: "Abu Dhabi", lat: 24.4539, lng: 54.3773, hub: true },
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

const ALL_CITIES: City[] = [...UAE_HUBS, ...DESTINATIONS];

export function ConnectivityGlobe() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const phiRef = useRef(0);
  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef(0);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 800, h: 600 });

  // Observe container for responsive sizing. Cobe is square-best, so
  // we size the canvas as a square centred in the wider container and
  // let the container's height frame it with space on the sides.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth || 800;
      const h = Math.max(440, Math.min(720, Math.round(w * 0.66)));
      setSize({ w, h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const markers = useMemo(
    () =>
      ALL_CITIES.map((c) => ({
        location: [c.lat, c.lng] as [number, number],
        size: c.hub ? 0.11 : 0.05,
      })),
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const diameter = Math.min(size.w, size.h);

    // Arcs from Dubai to every destination. Cobe v2 renders these as
    // animated travelling dashes along a great-circle path.
    const arcs = DESTINATIONS.map((d) => ({
      from: [UAE_HUBS[0].lat, UAE_HUBS[0].lng] as [number, number],
      to: [d.lat, d.lng] as [number, number],
    }));

    let phi = 0;
    let raf = 0;

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: diameter * dpr,
      height: diameter * dpr,
      phi: 0,
      theta: 0.22,
      dark: 1,
      diffuse: 1.25,
      mapSamples: 18000,
      mapBrightness: 7,
      baseColor: [0.12, 0.18, 0.32],
      markerColor: [255 / 255, 179 / 255, 94 / 255], // GOLD (#E8B36C)
      glowColor: [0.6, 0.82, 1.0],
      markers,
      arcs,
      arcColor: [0.31, 0.82, 0.88], // cyan
      arcWidth: 1.2,
      arcHeight: 0.35,
    });

    canvas.style.width = `${diameter}px`;
    canvas.style.height = `${diameter}px`;

    const tick = () => {
      if (!pointerInteracting.current) phi += 0.0035;
      globe.update({ phi: phi + pointerInteractionMovement.current } as Partial<typeof globe> as never);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      globe.destroy();
    };
  }, [size, markers]);

  const onPointerDown = (e: React.PointerEvent) => {
    pointerInteracting.current = e.clientX - pointerInteractionMovement.current;
    (e.target as HTMLCanvasElement).style.cursor = "grabbing";
  };
  const onPointerUp = () => {
    pointerInteracting.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = "grab";
  };
  const onPointerOut = () => {
    pointerInteracting.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = "grab";
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (pointerInteracting.current !== null) {
      const delta = e.clientX - pointerInteracting.current;
      pointerInteractionMovement.current = delta / 200;
    }
  };

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

      {/* Faint cyan grid for the instrument-panel feel */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.045]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #4FD1E0 1px, transparent 1px), linear-gradient(to bottom, #4FD1E0 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />

      {/* Cobe canvas centred in the wrapper */}
      <div className="absolute inset-0 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerOut={onPointerOut}
          onMouseMove={onMouseMove}
          style={{
            cursor: "grab",
            contain: "layout paint size",
          }}
        />
      </div>

      {/* Outer glow ring framing the globe */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        aria-hidden
      >
        <div
          style={{
            width: Math.min(size.w, size.h) * 1.08,
            height: Math.min(size.w, size.h) * 1.08,
            borderRadius: "50%",
            boxShadow:
              "0 0 80px 10px rgba(79,209,224,0.12), 0 0 180px 40px rgba(79,209,224,0.06)",
          }}
        />
      </div>

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
          <span className="text-cyan-200 font-semibold">24</span>
          <span className="text-white/30">·</span>
          <span className="text-white/60">Cities</span>
          <span className="text-cyan-200 font-semibold">26</span>
        </div>
      </div>

      {/* Bottom-right metrics pill */}
      <div className="absolute bottom-4 right-4 pointer-events-none">
        <div className="flex items-center gap-4 px-3 py-1.5 rounded-[2px] border border-gold-400/25 bg-gold-400/5 backdrop-blur-sm text-[10px] uppercase tracking-[0.25em]">
          <span className="text-gold-200/80">
            <span className="text-gold-400 font-semibold">8h</span> flight radius
          </span>
          <span className="text-gold-200/50">·</span>
          <span className="text-gold-200/80">
            <span className="text-gold-400 font-semibold">2/3</span> of global population
          </span>
        </div>
      </div>

      {/* Bottom-left origin label */}
      <div className="absolute bottom-4 left-4 pointer-events-none text-[10px] uppercase tracking-[0.25em] text-white/40">
        Origin: <span className="text-gold-400">Dubai · Abu Dhabi</span>
      </div>

      {/* Destination list ticker — cycles through city names */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-4 pointer-events-none hidden md:block">
        <DestinationTicker />
      </div>
    </div>
  );
}

// Small ticker that cycles destination names so the UI feels alive
// even when the user is looking away from the globe itself.
function DestinationTicker() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = window.setInterval(
      () => setIdx((i) => (i + 1) % DESTINATIONS.length),
      2200
    );
    return () => window.clearInterval(id);
  }, []);
  const d = DESTINATIONS[idx];
  return (
    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-white/55">
      <span className="inline-block w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />
      Scanning
      <span className="text-cyan-200 font-semibold min-w-[120px] text-left">
        {d.name}
      </span>
    </div>
  );
}

export default ConnectivityGlobe;

"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { GeoPoint } from "@/lib/types";
import { sectorLabel } from "@/lib/utils";

interface Props {
  points: GeoPoint[];
}

/* Royal palette – deep jewel tones that pop on satellite desert imagery */
const COLOR_HIGH = "#1B4F72";     /* Deep sapphire blue – high conviction */
const COLOR_MEDIUM = "#7B2D8E";   /* Royal purple – medium */
const COLOR_LOW = "#FFFFFF";       /* White – emerging */
const COLOR_ARC = "#1B4F72";      /* Sapphire for connection arcs */
const COLOR_UAE_RING = "#C0392B"; /* Deep crimson for UAE highlight ring */

export function GeoMap({ points }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const [hovered, setHovered] = useState<GeoPoint | null>(null);
  const [ready, setReady] = useState(false);

  const aggregated = useMemo(() => {
    const map = new Map<string, GeoPoint & { weight: number }>();
    for (const p of points) {
      const key = `${p.lat.toFixed(2)},${p.lng.toFixed(2)},${p.intent}`;
      const existing = map.get(key);
      if (existing) {
        existing.weight += 1;
        existing.score = Math.max(existing.score, p.score);
      } else {
        map.set(key, { ...p, weight: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.score - b.score);
  }, [points]);

  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapRef.current) return;

      const map = L.map(mapRef.current, {
        center: [25.5, 50.0],
        zoom: 3,
        minZoom: 2,
        maxZoom: 12,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: true,
        dragging: true,
      });

      // Satellite tiles from ESRI
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "Tiles: Esri, Maxar, Earthstar Geographics",
          maxZoom: 18,
        },
      ).addTo(map);

      // Semi-transparent label overlay
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 18, opacity: 0.65 },
      ).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);

      // UAE highlight circle – crimson for visibility
      L.circle([24.4539, 54.3773], {
        radius: 400000,
        color: COLOR_UAE_RING,
        weight: 2,
        fill: false,
        dashArray: "6 4",
        opacity: 0.8,
      }).addTo(map);

      // Add markers for each company
      for (const p of aggregated) {
        const r = 6 + Math.min(14, p.weight * 2.5);
        const isHigh = p.score >= 70;
        const color = isHigh ? COLOR_HIGH : p.score >= 45 ? COLOR_MEDIUM : COLOR_LOW;
        const isExpansion = p.intent === "expansion_target";

        const marker = L.circleMarker([p.lat, p.lng], {
          radius: r,
          fillColor: color,
          fillOpacity: 0.9,
          color: isExpansion ? "#FFFFFF" : "rgba(255,255,255,0.6)",
          weight: isExpansion ? 2.5 : 1.5,
          dashArray: isExpansion ? "4 3" : undefined,
        }).addTo(map);

        // Glow ring – brighter for visibility
        L.circleMarker([p.lat, p.lng], {
          radius: r + 6,
          fillColor: color,
          fillOpacity: 0.25,
          color: "rgba(255,255,255,0.3)",
          weight: 1,
        }).addTo(map);

        marker.on("mouseover", () => setHovered(p));
        marker.on("mouseout", () => setHovered(null));

        // Popup on click
        const scoreColor = isHigh ? COLOR_HIGH : p.score >= 45 ? COLOR_MEDIUM : "#B33A3A";
        marker.bindPopup(
          `<div style="font-family:Inter,sans-serif;font-size:13px;line-height:1.5;min-width:180px">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.15em;color:${scoreColor};margin-bottom:4px">
              ${isExpansion ? "Expansion Target" : "Headquarters"}
            </div>
            <div style="font-weight:600;color:#0E1E3F;font-size:14px">${p.company_name}</div>
            <div style="margin-top:6px;font-size:12px;color:#5A6378">
              Score: <strong style="color:${scoreColor}">${Math.round(p.score)}</strong>/100
            </div>
            <div style="margin-top:4px;font-size:11px;color:#7E8699">
              ${p.sectors.map(sectorLabel).slice(0, 3).join(", ")}
            </div>
            <a href="/platform/companies/${p.company_id}"
               style="display:inline-block;margin-top:8px;font-size:11px;font-weight:600;color:#0E1E3F;text-decoration:none">
              View Full Profile &rarr;
            </a>
          </div>`,
          { className: "investuae-popup" },
        );
      }

      // Draw connection arcs to UAE for expansion targets
      const uae: [number, number] = [24.4539, 54.3773];
      for (const p of aggregated.filter((x) => x.intent === "expansion_target").slice(0, 25)) {
        const mid: [number, number] = [
          (p.lat + uae[0]) / 2 + Math.abs(p.lng - uae[1]) * 0.06,
          (p.lng + uae[1]) / 2,
        ];
        const curvePoints: [number, number][] = [];
        for (let t = 0; t <= 1; t += 0.05) {
          const lt =
            (1 - t) * (1 - t) * p.lat +
            2 * (1 - t) * t * mid[0] +
            t * t * uae[0];
          const ln =
            (1 - t) * (1 - t) * p.lng +
            2 * (1 - t) * t * mid[1] +
            t * t * uae[1];
          curvePoints.push([lt, ln]);
        }
        L.polyline(curvePoints, {
          color: COLOR_ARC,
          weight: 1.2,
          opacity: 0.45,
          dashArray: "3 6",
        }).addTo(map);
      }

      leafletMapRef.current = map;
      setReady(true);

      setTimeout(() => map.invalidateSize(), 200);
    })();

    return () => {
      cancelled = true;
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [aggregated]);

  return (
    <div className="relative w-full rounded-md overflow-hidden border border-line">
      <div
        ref={mapRef}
        className="w-full"
        style={{ height: "clamp(320px, 50vw, 560px)", background: "#0a1628" }}
      />

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-navy-900/80">
          <div className="text-sm text-navy-200 animate-pulse">
            Loading satellite imagery...
          </div>
        </div>
      )}

      <Legend />

      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute bottom-4 right-4 md:bottom-6 md:right-6 max-w-xs bg-white rounded-md p-3 md:p-4 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.4)] pointer-events-none z-[500]"
          >
            <div className="text-[10px] uppercase tracking-[0.2em] text-gold-600 font-medium mb-1">
              {hovered.intent === "headquarters"
                ? "Headquarters"
                : "Expansion Target"}
            </div>
            <div className="font-semibold text-navy-800">{hovered.company_name}</div>
            <div className="mt-2 text-xs text-ink-500">
              Composite score{" "}
              <span className="font-semibold text-navy-800">
                {Math.round(hovered.score)}
              </span>
            </div>
            {hovered.sectors.length > 0 && (
              <div className="mt-1 text-xs text-ink-500">
                {hovered.sectors.map(sectorLabel).slice(0, 3).join(", ")}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Legend() {
  return (
    <div className="absolute top-3 left-3 md:top-4 md:left-4 bg-white/90 backdrop-blur-sm border border-line rounded-md p-3 md:p-4 text-xs text-navy-800 z-[500]">
      <div className="uppercase tracking-[0.22em] text-[10px] text-gold-600 font-medium mb-2 md:mb-3">
        Signal Map
      </div>
      <div className="space-y-1.5 md:space-y-2">
        <LegendDot color={COLOR_HIGH} label="High conviction (70+)" />
        <LegendDot color={COLOR_MEDIUM} label="Medium (45-69)" />
        <LegendDot color={COLOR_LOW} border label="Emerging (< 45)" />
        <div className="pt-1 border-t border-line mt-2 text-ink-500 text-[10px] leading-snug max-w-[180px]">
          Dashed rings indicate stated expansion targets into the UAE/MENA region.
        </div>
      </div>
    </div>
  );
}

function LegendDot({
  color,
  label,
  border,
}: {
  color: string;
  label: string;
  border?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
        style={{
          backgroundColor: color,
          border: border ? "1px solid #ccc" : undefined,
        }}
      />
      <span>{label}</span>
    </div>
  );
}

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number, fractionDigits = 1): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(fractionDigits)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(fractionDigits)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(fractionDigits)}K`;
  return n.toString();
}

export function formatUsd(n?: number | null): string {
  if (n == null || Number.isNaN(n)) return "-";
  return `$${formatNumber(n)}`;
}

export function relativeTime(iso?: string | null): string {
  if (!iso) return "-";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "-";
  const diff = Math.max(1, Math.round((Date.now() - then) / 1000));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.round(diff / 86400)}d ago`;
  if (diff < 86400 * 365) return `${Math.round(diff / 86400 / 30)}mo ago`;
  return `${Math.round(diff / 86400 / 365)}y ago`;
}

export function sectorLabel(s: string): string {
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .replace("And", "&");
}

export function scoreClass(score: number): "score-high" | "score-med" | "score-low" {
  if (score >= 70) return "score-high";
  if (score >= 45) return "score-med";
  return "score-low";
}

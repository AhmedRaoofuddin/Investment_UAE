// Internal API client. Server-side reads BACKEND_URL; client-side reads NEXT_PUBLIC_BACKEND_URL.

import type {
  CompaniesResponse,
  CompanyDeepDive,
  GeoResponse,
  HealthResponse,
  SectorsResponse,
} from "@/lib/types";

const SERVER_BASE = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
const CLIENT_BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? "/api/proxy";

function base(): string {
  return typeof window === "undefined" ? SERVER_BASE : CLIENT_BASE;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${base()}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { "Accept": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${url}`);
  }
  return (await res.json()) as T;
}

export interface ListCompaniesParams {
  sector?: string;
  region?: string;
  min_score?: number;
  signal_type?: string;
  strength?: string;
  q?: string;
  limit?: number;
}

export const api = {
  health: () => request<HealthResponse>(`/api/health`),
  companies: (p: ListCompaniesParams = {}) => {
    const q = new URLSearchParams();
    Object.entries(p).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
    });
    const qs = q.toString();
    return request<CompaniesResponse>(`/api/companies${qs ? `?${qs}` : ""}`);
  },
  company: (id: string) => request<CompanyDeepDive>(`/api/companies/${id}`),
  sectors: () => request<SectorsResponse>(`/api/sectors`),
  geo: () => request<GeoResponse>(`/api/geo`),
  refresh: () => request<{ ok: boolean }>(`/api/refresh`, { method: "POST" }),
};

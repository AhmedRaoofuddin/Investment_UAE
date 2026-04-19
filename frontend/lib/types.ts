// Mirrors backend/app/models/schemas.py

export type SignalType =
  | "funding"
  | "expansion"
  | "hiring"
  | "partnership"
  | "launch"
  | "regulatory"
  | "m_and_a"
  | "executive";

export type SignalStrength = "high" | "medium" | "low";

export type Sector =
  | "fintech"
  | "artificial_intelligence"
  | "cleantech"
  | "healthcare"
  | "logistics"
  | "real_estate"
  | "ecommerce"
  | "manufacturing"
  | "energy"
  | "tourism"
  | "education"
  | "agritech"
  | "space"
  | "defense"
  | "other";

export interface SourceArticle {
  title: string;
  url: string;
  source_name: string;
  source_region: string;
  published_at?: string | null;
  summary?: string | null;
  image_url?: string | null;
}

export interface Signal {
  id: string;
  type: SignalType;
  strength: SignalStrength;
  headline: string;
  rationale: string;
  detected_at: string;
  source: SourceArticle;
}

export interface CompanyLocation {
  country?: string | null;
  country_code?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface Company {
  id: string;
  name: string;
  aliases: string[];
  description?: string | null;
  sectors: Sector[];
  headquarters?: CompanyLocation | null;
  expansion_targets: CompanyLocation[];
  website?: string | null;
  founded_year?: number | null;
  employee_band?: string | null;
  last_funding_usd?: number | null;
  total_funding_usd?: number | null;
  investability_score: number;
  uae_alignment_score: number;
  signals: Signal[];
  first_seen: string;
  last_seen: string;
}

export interface CompaniesResponse {
  generated_at: string;
  pipeline_run_ms: number;
  total: number;
  items: Company[];
}

export interface SectorAggregate {
  sector: Sector;
  company_count: number;
  signal_count: number;
  avg_score: number;
  top_companies: string[];
}

export interface SectorsResponse {
  generated_at: string;
  items: SectorAggregate[];
}

export interface GeoPoint {
  company_id: string;
  company_name: string;
  lat: number;
  lng: number;
  intent: "headquarters" | "expansion_target";
  score: number;
  sectors: Sector[];
}

export interface GeoResponse {
  generated_at: string;
  items: GeoPoint[];
}

export interface CompanyDeepDive {
  company: Company;
  investment_thesis: string;
  risks: string[];
  next_actions: string[];
  related_signals: Signal[];
}

export interface HealthResponse {
  status: string;
  version: string;
  cache_age_minutes?: number | null;
  cached_companies: number;
}

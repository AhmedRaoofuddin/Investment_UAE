"""
Pydantic schemas — the public contract of the API.
Mirrored on the TypeScript side under frontend/lib/types.ts.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class SignalType(str, Enum):
    FUNDING = "funding"
    EXPANSION = "expansion"
    HIRING = "hiring"
    PARTNERSHIP = "partnership"
    LAUNCH = "launch"
    REGULATORY = "regulatory"
    MA = "m_and_a"
    EXECUTIVE = "executive"


class SignalStrength(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class Sector(str, Enum):
    FINTECH = "fintech"
    AI = "artificial_intelligence"
    CLEANTECH = "cleantech"
    HEALTHCARE = "healthcare"
    LOGISTICS = "logistics"
    REAL_ESTATE = "real_estate"
    ECOMMERCE = "ecommerce"
    MANUFACTURING = "manufacturing"
    ENERGY = "energy"
    TOURISM = "tourism"
    EDUCATION = "education"
    AGRITECH = "agritech"
    SPACE = "space"
    DEFENSE = "defense"
    OTHER = "other"


class SourceArticle(BaseModel):
    title: str
    url: str
    source_name: str
    source_region: str
    published_at: Optional[datetime] = None
    summary: Optional[str] = None
    # Lead image pulled from the RSS entry (media:content, media:thumbnail,
    # <enclosure type="image/*">, or the first <img> in summary HTML).
    # Absent on feeds that don't expose one — the UI falls back gracefully.
    image_url: Optional[str] = None


class Signal(BaseModel):
    id: str
    type: SignalType
    strength: SignalStrength
    headline: str = Field(..., description="One-line plain-English description of the signal")
    rationale: str = Field(..., description="2-3 sentences on why this is investable")
    detected_at: datetime
    source: SourceArticle


class CompanyLocation(BaseModel):
    country: Optional[str] = None
    country_code: Optional[str] = None
    city: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class Company(BaseModel):
    id: str
    name: str
    aliases: List[str] = Field(default_factory=list)
    description: Optional[str] = None
    sectors: List[Sector] = Field(default_factory=list)
    headquarters: Optional[CompanyLocation] = None
    expansion_targets: List[CompanyLocation] = Field(default_factory=list)
    website: Optional[str] = None
    founded_year: Optional[int] = None
    employee_band: Optional[str] = None
    last_funding_usd: Optional[float] = None
    total_funding_usd: Optional[float] = None
    investability_score: float = Field(0.0, ge=0.0, le=100.0)
    uae_alignment_score: float = Field(0.0, ge=0.0, le=100.0)
    signals: List[Signal] = Field(default_factory=list)
    first_seen: datetime
    last_seen: datetime


class CompaniesResponse(BaseModel):
    generated_at: datetime
    pipeline_run_ms: int
    total: int
    items: List[Company]


class SectorAggregate(BaseModel):
    sector: Sector
    company_count: int
    signal_count: int
    avg_score: float
    top_companies: List[str]


class SectorsResponse(BaseModel):
    generated_at: datetime
    items: List[SectorAggregate]


class GeoPoint(BaseModel):
    company_id: str
    company_name: str
    lat: float
    lng: float
    intent: str  # "headquarters" | "expansion_target"
    score: float
    sectors: List[Sector]


class GeoResponse(BaseModel):
    generated_at: datetime
    items: List[GeoPoint]


class CompanyDeepDive(BaseModel):
    company: Company
    investment_thesis: str
    risks: List[str]
    next_actions: List[str]
    related_signals: List[Signal]


class HealthResponse(BaseModel):
    status: str
    version: str
    cache_age_minutes: Optional[int] = None
    cached_companies: int

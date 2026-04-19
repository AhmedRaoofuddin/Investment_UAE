"""
Lightweight country / city → coordinates lookup for MENA + global hubs.
Used to plot signals on the Geo-Intelligence map without a paid geocoder.
"""
from __future__ import annotations

from typing import Optional

from app.models.schemas import CompanyLocation


# Curated centroid lookup. Values are (lat, lng, country_code).
COUNTRY_CENTROIDS: dict[str, tuple[float, float, str]] = {
    # GCC + MENA
    "united arab emirates": (24.4539, 54.3773, "AE"),
    "uae": (24.4539, 54.3773, "AE"),
    "saudi arabia": (24.7136, 46.6753, "SA"),
    "ksa": (24.7136, 46.6753, "SA"),
    "qatar": (25.2854, 51.5310, "QA"),
    "kuwait": (29.3759, 47.9774, "KW"),
    "bahrain": (26.0667, 50.5577, "BH"),
    "oman": (23.5880, 58.3829, "OM"),
    "egypt": (30.0444, 31.2357, "EG"),
    "jordan": (31.9454, 35.9284, "JO"),
    "lebanon": (33.8938, 35.5018, "LB"),
    "morocco": (33.5731, -7.5898, "MA"),
    "tunisia": (36.8065, 10.1815, "TN"),
    "algeria": (36.7372, 3.0866, "DZ"),
    "iraq": (33.3152, 44.3661, "IQ"),
    "turkey": (41.0082, 28.9784, "TR"),
    "israel": (32.0853, 34.7818, "IL"),
    "pakistan": (33.6844, 73.0479, "PK"),
    # Global hubs that often expand into UAE
    "united states": (40.7128, -74.0060, "US"),
    "usa": (40.7128, -74.0060, "US"),
    "united kingdom": (51.5074, -0.1278, "GB"),
    "uk": (51.5074, -0.1278, "GB"),
    "singapore": (1.3521, 103.8198, "SG"),
    "india": (19.0760, 72.8777, "IN"),
    "china": (31.2304, 121.4737, "CN"),
    "germany": (52.5200, 13.4050, "DE"),
    "france": (48.8566, 2.3522, "FR"),
    "switzerland": (47.3769, 8.5417, "CH"),
    "netherlands": (52.3676, 4.9041, "NL"),
    "australia": (-33.8688, 151.2093, "AU"),
    "japan": (35.6762, 139.6503, "JP"),
    "south korea": (37.5665, 126.9780, "KR"),
}

CITY_CENTROIDS: dict[str, tuple[float, float, str, str]] = {
    # MENA cities
    "dubai": (25.2048, 55.2708, "United Arab Emirates", "AE"),
    "abu dhabi": (24.4539, 54.3773, "United Arab Emirates", "AE"),
    "sharjah": (25.3463, 55.4209, "United Arab Emirates", "AE"),
    "ras al khaimah": (25.6741, 55.9804, "United Arab Emirates", "AE"),
    "riyadh": (24.7136, 46.6753, "Saudi Arabia", "SA"),
    "jeddah": (21.4858, 39.1925, "Saudi Arabia", "SA"),
    "neom": (28.0339, 35.0934, "Saudi Arabia", "SA"),
    "doha": (25.2854, 51.5310, "Qatar", "QA"),
    "manama": (26.2285, 50.5860, "Bahrain", "BH"),
    "kuwait city": (29.3759, 47.9774, "Kuwait", "KW"),
    "muscat": (23.5880, 58.3829, "Oman", "OM"),
    "cairo": (30.0444, 31.2357, "Egypt", "EG"),
    "amman": (31.9454, 35.9284, "Jordan", "JO"),
    "beirut": (33.8938, 35.5018, "Lebanon", "LB"),
    "casablanca": (33.5731, -7.5898, "Morocco", "MA"),
    "istanbul": (41.0082, 28.9784, "Turkey", "TR"),
    "tel aviv": (32.0853, 34.7818, "Israel", "IL"),
    # Global
    "san francisco": (37.7749, -122.4194, "United States", "US"),
    "new york": (40.7128, -74.0060, "United States", "US"),
    "london": (51.5074, -0.1278, "United Kingdom", "GB"),
    "singapore": (1.3521, 103.8198, "Singapore", "SG"),
    "berlin": (52.5200, 13.4050, "Germany", "DE"),
    "paris": (48.8566, 2.3522, "France", "FR"),
    "mumbai": (19.0760, 72.8777, "India", "IN"),
    "bangalore": (12.9716, 77.5946, "India", "IN"),
    "shanghai": (31.2304, 121.4737, "China", "CN"),
    "hong kong": (22.3193, 114.1694, "China", "CN"),
    "tokyo": (35.6762, 139.6503, "Japan", "JP"),
    "seoul": (37.5665, 126.9780, "South Korea", "KR"),
    "sydney": (-33.8688, 151.2093, "Australia", "AU"),
    "zurich": (47.3769, 8.5417, "Switzerland", "CH"),
    "amsterdam": (52.3676, 4.9041, "Netherlands", "NL"),
}


def resolve_location(country: Optional[str], city: Optional[str]) -> CompanyLocation:
    """Best-effort coordinate lookup. Returns a CompanyLocation, possibly empty."""
    loc = CompanyLocation()
    if city:
        key = city.strip().lower()
        if key in CITY_CENTROIDS:
            lat, lng, ctry, cc = CITY_CENTROIDS[key]
            loc.city = city
            loc.country = country or ctry
            loc.country_code = cc
            loc.lat = lat
            loc.lng = lng
            return loc

    if country:
        key = country.strip().lower()
        if key in COUNTRY_CENTROIDS:
            lat, lng, cc = COUNTRY_CENTROIDS[key]
            loc.country = country
            loc.country_code = cc
            loc.lat = lat
            loc.lng = lng
            if city:
                loc.city = city
            return loc

    if country:
        loc.country = country
    if city:
        loc.city = city
    return loc

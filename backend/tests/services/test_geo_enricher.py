"""Geo-enricher — pure-Python centroid resolver.

Tests guard against silent coordinate drift. A 1-degree shift would put
Dubai in the Persian Gulf instead of on the coast.
"""
from __future__ import annotations

import pytest

from app.services.geo_enricher import (
    resolve_location,
    CITY_CENTROIDS,
    COUNTRY_CENTROIDS,
)


pytestmark = pytest.mark.service


class TestCityResolution:
    def test_dubai_city_resolves_to_correct_point(self) -> None:
        loc = resolve_location(country=None, city="Dubai")
        assert loc.country_code == "AE"
        assert loc.country == "United Arab Emirates"
        assert loc.lat == pytest.approx(25.2048, abs=0.01)
        assert loc.lng == pytest.approx(55.2708, abs=0.01)

    def test_abu_dhabi_resolves_in_uae(self) -> None:
        loc = resolve_location(country=None, city="Abu Dhabi")
        assert loc.country_code == "AE"

    def test_riyadh_resolves_in_saudi(self) -> None:
        loc = resolve_location(country=None, city="Riyadh")
        assert loc.country_code == "SA"

    def test_case_insensitive(self) -> None:
        lower = resolve_location(country=None, city="DUBAI")
        title = resolve_location(country=None, city="Dubai")
        assert lower.lat == title.lat
        assert lower.lng == title.lng

    def test_city_wins_over_country(self) -> None:
        """'Dubai, Saudi Arabia' is obviously wrong input — the city
        has primacy. This prevents the marker showing up in Riyadh."""
        loc = resolve_location(country="Saudi Arabia", city="Dubai")
        assert loc.country_code == "AE"


class TestCountryResolution:
    def test_uae_country_resolves(self) -> None:
        loc = resolve_location(country="United Arab Emirates", city=None)
        assert loc.country_code == "AE"

    def test_uae_alias(self) -> None:
        loc = resolve_location(country="UAE", city=None)
        assert loc.country_code == "AE"

    def test_ksa_alias(self) -> None:
        loc = resolve_location(country="KSA", city=None)
        assert loc.country_code == "SA"


class TestUnknownInput:
    def test_nothing_in_nothing_out(self) -> None:
        loc = resolve_location(country=None, city=None)
        assert loc.country is None
        assert loc.city is None
        assert loc.lat is None

    def test_unknown_country_preserves_label(self) -> None:
        loc = resolve_location(country="Vulcan", city=None)
        assert loc.country == "Vulcan"
        assert loc.country_code is None
        assert loc.lat is None


class TestCatalogueIntegrity:
    """Coverage assertions. If these shrink, Ministry-critical regions
    start dropping off the geo map silently."""

    def test_all_gcc_in_country_lookup(self) -> None:
        required = {"united arab emirates", "saudi arabia", "qatar",
                   "bahrain", "kuwait", "oman"}
        missing = required - set(COUNTRY_CENTROIDS.keys())
        assert missing == set()

    def test_all_major_uae_cities(self) -> None:
        for city in ["dubai", "abu dhabi", "sharjah", "ras al khaimah"]:
            assert city in CITY_CENTROIDS, city

    def test_centroid_in_valid_range(self) -> None:
        for name, (lat, lng, _) in COUNTRY_CENTROIDS.items():
            assert -90 <= lat <= 90, f"{name} lat out of range: {lat}"
            assert -180 <= lng <= 180, f"{name} lng out of range: {lng}"

"""
Entity Extraction Agent — Extracts companies, locations, and funding from text.

Uses regex patterns, gazetteer lookups, and heuristic rules to identify:
  - Company names and aliases
  - Headquarters and expansion target locations
  - Funding amounts (USD)
  - Key executives mentioned

No heavy ML dependency — works everywhere with zero setup.
Optionally enhanced with sentence-transformers for entity disambiguation.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)


# ────────────────────────────────────────────────────────────────────
# Location gazetteers
# ────────────────────────────────────────────────────────────────────

MENA_CITIES = {
    "dubai": ("United Arab Emirates", "AE", "Dubai", 25.2048, 55.2708),
    "abu dhabi": ("United Arab Emirates", "AE", "Abu Dhabi", 24.4539, 54.3773),
    "sharjah": ("United Arab Emirates", "AE", "Sharjah", 25.3573, 55.4033),
    "ras al khaimah": ("United Arab Emirates", "AE", "Ras Al Khaimah", 25.6741, 55.9804),
    "ajman": ("United Arab Emirates", "AE", "Ajman", 25.4052, 55.5136),
    "riyadh": ("Saudi Arabia", "SA", "Riyadh", 24.7136, 46.6753),
    "jeddah": ("Saudi Arabia", "SA", "Jeddah", 21.4858, 39.1925),
    "neom": ("Saudi Arabia", "SA", "NEOM", 28.0339, 35.0934),
    "dammam": ("Saudi Arabia", "SA", "Dammam", 26.4207, 50.0888),
    "doha": ("Qatar", "QA", "Doha", 25.2854, 51.531),
    "manama": ("Bahrain", "BH", "Manama", 26.2285, 50.586),
    "kuwait city": ("Kuwait", "KW", "Kuwait City", 29.3759, 47.9774),
    "muscat": ("Oman", "OM", "Muscat", 23.6139, 58.5922),
    "cairo": ("Egypt", "EG", "Cairo", 30.0444, 31.2357),
    "amman": ("Jordan", "JO", "Amman", 31.9454, 35.9284),
    "beirut": ("Lebanon", "LB", "Beirut", 33.8938, 35.5018),
    "casablanca": ("Morocco", "MA", "Casablanca", 33.5731, -7.5898),
    "istanbul": ("Turkey", "TR", "Istanbul", 41.008, 28.978),
    "tel aviv": ("Israel", "IL", "Tel Aviv", 32.0853, 34.7818),
}

GLOBAL_CITIES = {
    "san francisco": ("United States", "US", "San Francisco", 37.7749, -122.4194),
    "new york": ("United States", "US", "New York", 40.7128, -74.006),
    "silicon valley": ("United States", "US", "San Francisco", 37.3861, -122.0839),
    "london": ("United Kingdom", "GB", "London", 51.5074, -0.1278),
    "singapore": ("Singapore", "SG", "Singapore", 1.3521, 103.8198),
    "berlin": ("Germany", "DE", "Berlin", 52.52, 13.405),
    "paris": ("France", "FR", "Paris", 48.8566, 2.3522),
    "mumbai": ("India", "IN", "Mumbai", 19.076, 72.8777),
    "bangalore": ("India", "IN", "Bangalore", 12.9716, 77.5946),
    "shanghai": ("China", "CN", "Shanghai", 31.2304, 121.4737),
    "hong kong": ("China", "CN", "Hong Kong", 22.3193, 114.1694),
    "tokyo": ("Japan", "JP", "Tokyo", 35.6762, 139.6503),
    "seoul": ("South Korea", "KR", "Seoul", 37.5665, 126.978),
    "sydney": ("Australia", "AU", "Sydney", -33.8688, 151.2093),
    "zurich": ("Switzerland", "CH", "Zurich", 47.3769, 8.5417),
    "amsterdam": ("Netherlands", "NL", "Amsterdam", 52.3676, 4.9041),
}

ALL_CITIES = {**MENA_CITIES, **GLOBAL_CITIES}

COUNTRY_NAMES = {
    "uae": ("United Arab Emirates", "AE"),
    "united arab emirates": ("United Arab Emirates", "AE"),
    "saudi arabia": ("Saudi Arabia", "SA"),
    "saudi": ("Saudi Arabia", "SA"),
    "ksa": ("Saudi Arabia", "SA"),
    "qatar": ("Qatar", "QA"),
    "bahrain": ("Bahrain", "BH"),
    "kuwait": ("Kuwait", "KW"),
    "oman": ("Oman", "OM"),
    "egypt": ("Egypt", "EG"),
    "jordan": ("Jordan", "JO"),
    "lebanon": ("Lebanon", "LB"),
    "morocco": ("Morocco", "MA"),
    "turkey": ("Turkey", "TR"),
    "israel": ("Israel", "IL"),
    "pakistan": ("Pakistan", "PK"),
    "india": ("India", "IN"),
    "united states": ("United States", "US"),
    "united kingdom": ("United Kingdom", "GB"),
    "uk": ("United Kingdom", "GB"),
    "us": ("United States", "US"),
    "usa": ("United States", "US"),
    "china": ("China", "CN"),
    "japan": ("Japan", "JP"),
    "germany": ("Germany", "DE"),
    "france": ("France", "FR"),
    "singapore": ("Singapore", "SG"),
    "south korea": ("South Korea", "KR"),
    "australia": ("Australia", "AU"),
    "switzerland": ("Switzerland", "CH"),
    "netherlands": ("Netherlands", "NL"),
    "iraq": ("Iraq", "IQ"),
    "tunisia": ("Tunisia", "TN"),
    "algeria": ("Algeria", "DZ"),
}

# Common company suffixes to strip for normalization
COMPANY_SUFFIXES = re.compile(
    r"\s*\b(?:Inc\.?|Ltd\.?|LLC|PLC|Corp\.?|Corporation|Company|Co\.?|PJSC|JSC|"
    r"Holdings?|Group|International|Technologies|Tech|Solutions|Ventures?|"
    r"Capital|Partners|Management|Fund|Limited)\b\.?\s*$",
    re.IGNORECASE,
)

# Patterns for extracting funding amounts
FUNDING_PATTERNS = [
    # "$100M", "$1.5B", "USD 200M"
    re.compile(r"(?:USD|\$|US\$)\s*([\d,]+\.?\d*)\s*(billion|million|[BMK])\b", re.I),
    # "100 million dollars"
    re.compile(r"([\d,]+\.?\d*)\s*(billion|million|thousand)\s*(?:US\s+)?dollars?", re.I),
    # "raises $100M"
    re.compile(r"(?:raises?|raised|secures?|secured|closes?)\s+(?:USD|\$|US\$)\s*([\d,]+\.?\d*)\s*([BMK]?)", re.I),
]

MULTIPLIERS = {
    "b": 1_000_000_000,
    "billion": 1_000_000_000,
    "m": 1_000_000,
    "million": 1_000_000,
    "k": 1_000,
    "thousand": 1_000,
}


@dataclass
class ExtractedEntity:
    """A company entity extracted from text."""
    name: str
    aliases: List[str] = field(default_factory=list)
    description: Optional[str] = None
    headquarters_country: Optional[str] = None
    headquarters_country_code: Optional[str] = None
    headquarters_city: Optional[str] = None
    headquarters_lat: Optional[float] = None
    headquarters_lng: Optional[float] = None
    expansion_countries: List[str] = field(default_factory=list)
    expansion_cities: List[str] = field(default_factory=list)
    funding_usd: Optional[float] = None
    executives: List[str] = field(default_factory=list)


class EntityAgent:
    """Extracts structured entities from news article text."""

    def __init__(self):
        self._known_companies: Set[str] = set()

    def extract_funding(self, text: str) -> Optional[float]:
        """Extract the largest funding amount mentioned in text."""
        amounts: List[float] = []
        for pattern in FUNDING_PATTERNS:
            for match in pattern.finditer(text):
                try:
                    num_str = match.group(1).replace(",", "")
                    num = float(num_str)
                    suffix = (match.group(2) or "").lower().strip()
                    multiplier = MULTIPLIERS.get(suffix, 1)
                    if suffix == "" and num < 100:
                        # Bare number < 100 likely millions
                        multiplier = 1_000_000
                    amounts.append(num * multiplier)
                except (ValueError, IndexError):
                    continue
        return max(amounts) if amounts else None

    def extract_locations(self, text: str) -> Tuple[List[str], List[str]]:
        """
        Extract mentioned cities and countries from text.
        Returns (cities_found, countries_found).
        """
        text_lower = text.lower()
        cities_found = []
        countries_found = []

        for city_key, info in ALL_CITIES.items():
            if city_key in text_lower:
                cities_found.append(city_key)

        for country_key, info in COUNTRY_NAMES.items():
            if country_key in text_lower:
                countries_found.append(country_key)

        return cities_found, countries_found

    # Phrases that, if present in a candidate, mark it as a sentence
    # fragment rather than a real company name. The regex patterns below
    # sometimes greedily capture clause-level text like "The round was led
    # by existing new" before an action verb; this filter drops them.
    _FRAGMENT_WORDS = {
        # Financial / round-level noise
        "round", "series", "million", "billion", "funding", "investment",
        "investors", "raised", "raises", "secured", "secures", "backed",
        "backs", "led", "participation", "participated", "announced",
        "announces", "the", "this", "these", "those", "their", "its",
        "a", "an", "some", "new", "existing", "among", "including",
        # Common headline verbs that mean the capture bled into the VP
        # (e.g. "UAE leads MENA startup funding", "MidEast boosts…",
        # "UAE and Germany formalise strategic energy"). NOTE: "partners"
        # and "holdings" are common in legit names (Safar Partners, IHC
        # Holdings) so we don't include them here — instead the trailing-
        # word + glue-count rules will catch their fragmented uses.
        "leads", "boosts", "launches", "signs", "drives", "hosts",
        "forges", "formalises", "formalise", "finalises", "finalise",
        "commits", "targets", "unveils", "plans", "enters",
        "acquires", "completes", "doubles", "triples",
        "expands", "inks", "bags", "lands", "debuts",
        # Common headline noise
        "strategic", "comprehensive",
        # Verbs/fragments from the remaining mis-captures
        "form", "footprint", "port", "legend", "lendtech",
        "sqm", "said", "they", "are",
    }

    _STOPWORD_STARTS = {
        "the", "a", "an", "this", "that", "these", "those", "some",
        "new", "existing", "several", "other", "its", "their",
        "among", "with", "by", "from", "for", "in", "on", "of",
    }

    def _looks_like_company(self, name: str) -> bool:
        """Instance-method delegator so existing call sites continue to
        work. The real logic lives on the classmethod below so the
        orchestrator can call it without instantiating the agent."""
        return EntityAgent._looks_like_company_name(name)

    @classmethod
    def _looks_like_company_name(cls, name: str) -> bool:
        """Reject obvious sentence fragments that the regex patterns
        sometimes capture as 'company names'. Keeps short Title-Cased
        tokens, rejects clause-level noise like 'the round was led by'
        or 'uae leads mena startup'."""
        if not name or len(name) < 2:
            return False
        trimmed = name.strip()
        # Trailing/leading punctuation like " -" or ".The" means we cut
        # mid-sentence. Strip first, but a name ending in punctuation
        # other than a known suffix is suspicious.
        if re.search(r"[.,;:\-]\s*$", trimmed):
            return False
        if re.search(r"\b[A-Z][a-z]+\.[A-Z]", trimmed):
            # e.g. "goals.The" — two sentences fused by broken parsing.
            return False

        words = trimmed.split()
        if not words:
            return False
        # No more than 6 words — real company names rarely exceed that.
        if len(words) > 6:
            return False
        # First token can't be a stopword / determiner.
        if words[0].lower() in cls._STOPWORD_STARTS:
            return False
        # Single-character first "word" is almost always a parsing artefact
        # ("M in Real Estate"), unless it's a known initialism with dots.
        if len(words[0]) == 1 and "." not in words[0]:
            return False
        # Must contain at least one alphabetic character.
        if not any(c.isalpha() for c in trimmed):
            return False
        # Reject if any fragment-marker word appears — these are clause
        # fragments rather than company names.
        lowered_tokens = [w.strip(".,;:()'\"").lower() for w in words]
        lowered_set = set(lowered_tokens)
        if lowered_set & cls._FRAGMENT_WORDS:
            return False
        # Reject if >1 "glue" word is present — real company names have at
        # most one ("Bank of America", "Abu Dhabi"). Two or more means
        # we captured a sentence fragment.
        glue = {
            "of", "and", "for", "with", "from", "to", "in", "on", "at",
            "by", "the", "a", "an", "or", "is", "are", "was", "were",
            "said", "that", "which", "who", "whom", "been", "being",
            "have", "has", "had", "they", "their",
        }
        glue_count = sum(1 for t in lowered_tokens if t in glue)
        if glue_count >= 2:
            return False
        # Reject all-lowercase (CSS/attribute noise) or all-caps-long
        # (section headings / CSV artifacts).
        if trimmed == trimmed.lower():
            return False
        if trimmed == trimmed.upper() and len(trimmed) > 4:
            return False
        # Trailing article / preposition / auxiliary verb means we cut
        # mid-phrase ("EIIC will", "Starbucks has also", "March does not").
        if lowered_tokens[-1] in {
            "the", "a", "an", "and", "or", "of", "by", "for", "to",
            "in", "on", "at", "with", "from",
            # Auxiliary / modal verbs that leak in from headline subjects
            "has", "have", "had", "was", "were", "is", "are", "will",
            "would", "been", "being", "also", "not", "does", "did",
            # Common article-body adjectives the regex grabs trailing
            "major", "key", "new", "top", "first",
        }:
            return False
        # Single-token names that are countries, cities, or generic
        # one-word nouns are almost always location headers or article
        # meta rather than company mentions.
        if len(words) == 1:
            if words[0].lower() in {
                "dubai", "abu", "sharjah", "uae", "ksa", "qatar", "oman",
                "bahrain", "kuwait", "egypt", "jordan", "lebanon", "iraq",
                "morocco", "tunisia", "algeria", "saudi", "china", "india",
                "pakistan", "usa", "us", "uk", "eu", "africa", "asia",
                "europe", "mena", "gcc", "emirates", "jeddah", "riyadh",
                "cairo", "doha", "amman", "beirut", "muscat", "manama",
                "market", "business", "news", "global", "his", "why",
                "what", "how", "when", "where", "who", "which",
            }:
                return False
        # A token that's a 4-digit year (e.g. "2030") is a strong signal
        # of an article-body phrase ("Vision 2030 goals"), not a company.
        if any(re.fullmatch(r"(19|20)\d{2}", t) for t in words):
            return False
        # Tokens like "4.8m", "100bn", "45.6" inside a multi-word name
        # almost always mean we captured a stat fragment.
        if any(re.fullmatch(r"\d+(?:\.\d+)?[a-z]{0,3}", t.lower()) for t in words if not t.isalpha()):
            return False
        # Reject "UAE as FINTECH.TV" style — the second token being a
        # lowercase preposition/conjunction means the capture spans a
        # clause boundary. `as` isn't in the glue set because "XYZ as a
        # Service" type phrases are real, but in this combined check
        # with uppercase-first we're on the fragment side.
        if len(words) >= 3 and words[1].lower() in {"as", "and", "is", "was"}:
            return False
        # Too-short all-caps single-token names ("AI", "US") are usually
        # an abbreviation picked up as the subject.
        if len(words) == 1 and len(words[0]) <= 2:
            return False
        return True

    def extract_company_names(self, text: str) -> List[str]:
        """
        Extract likely company names from text using heuristics.
        Looks for capitalized multi-word phrases and known patterns.
        """
        companies: List[str] = []

        # Pattern: "CompanyName raises/launches/expands/partners/acquires/appoints..."
        action_pattern = re.compile(
            r"([A-Z][A-Za-z0-9\s&\-\.]{1,50}?)\s+"
            r"(?:raises?|launches?|expands?|partners?|acquires?|opens?|"
            r"secures?|signs?|announces?|completes?|unveils?|begins?|"
            r"receives?|obtains?|closes?|appoints?|names?|hires?|"
            r"promotes?|taps?|picks?|elevates?|invests?|backs?|"
            r"inks?|rolls?|introduces?|debuts?|bags?|lands?|"
            r"joins?|teams?|forges?|enters?|plans?|doubles?|triples?)",
        )
        for match in action_pattern.finditer(text):
            name = match.group(1).strip()
            name = COMPANY_SUFFIXES.sub("", name).strip()
            if self._looks_like_company(name):
                companies.append(name)

        # Pattern: "X appoints/names [Person] as/to CEO of [Company]"
        exec_of_pattern = re.compile(
            r"(?:CEO|CFO|CTO|COO|CMO|Chairman|President|Director|"
            r"Managing\s+Director|General\s+Manager|Head|VP|Vice\s+President)"
            r"\s+(?:of|at|for)\s+([A-Z][A-Za-z0-9\s&\-\.]{2,40}?)(?:\.|,|$|\s+(?:in|to|from|after|said|is|was))",
        )
        for match in exec_of_pattern.finditer(text):
            name = match.group(1).strip()
            name = COMPANY_SUFFIXES.sub("", name).strip()
            if self._looks_like_company(name):
                companies.append(name)

        # Pattern: "[Company]'s new CEO" / "[Company] names new CEO"
        possessive_pattern = re.compile(
            r"([A-Z][A-Za-z0-9\s&\-\.]{2,40}?)(?:'s|'s)\s+"
            r"(?:new\s+)?(?:CEO|CFO|CTO|COO|Chairman|President|Director|"
            r"Managing\s+Director|General\s+Manager)",
        )
        for match in possessive_pattern.finditer(text):
            name = match.group(1).strip()
            name = COMPANY_SUFFIXES.sub("", name).strip()
            if self._looks_like_company(name):
                companies.append(name)

        # Pattern: known company indicators
        indicator_pattern = re.compile(
            r"(?:company|startup|firm|unicorn|fintech|platform)\s+"
            r"([A-Z][A-Za-z0-9\s&\-\.]{2,40})",
        )
        for match in indicator_pattern.finditer(text):
            name = match.group(1).strip()
            name = COMPANY_SUFFIXES.sub("", name).strip()
            if self._looks_like_company(name):
                companies.append(name)

        # Deduplicate (case-insensitive)
        seen = set()
        unique = []
        for c in companies:
            key = c.lower().strip()
            if key not in seen:
                seen.add(key)
                unique.append(c)

        return unique[:10]  # Cap at 10

    def extract_executives(self, text: str) -> List[str]:
        """Extract mentioned executive names and titles."""
        executives = []
        exec_pattern = re.compile(
            r"(?:(?:CEO|CTO|CFO|COO|CMO|Chairman|President|Director|"
            r"Chief\s+\w+\s+Officer|Managing\s+Director|General\s+Manager)\s+)"
            r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})",
        )
        for match in exec_pattern.finditer(text):
            executives.append(match.group(0).strip())

        # Also try "Name, CEO of Company" pattern
        titled_pattern = re.compile(
            r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}),?\s+"
            r"(?:the\s+)?(?:CEO|CTO|CFO|COO|chairman|president|director|founder)"
        )
        for match in titled_pattern.finditer(text):
            executives.append(match.group(0).strip())

        return list(set(executives))[:5]

    def infer_headquarters(
        self, text: str, cities: List[str], countries: List[str]
    ) -> Tuple[Optional[str], Optional[str], Optional[str], Optional[float], Optional[float]]:
        """
        Infer the most likely headquarters location from context.
        Returns (country, country_code, city, lat, lng).
        """
        text_lower = text.lower()

        # Look for explicit HQ mentions
        hq_patterns = [
            r"(?:headquartered|based|hq)\s+in\s+(\w[\w\s]*\w)",
            r"(\w[\w\s]*\w)\s*-?\s*based\s+(?:company|startup|firm)",
        ]
        for pattern in hq_patterns:
            match = re.search(pattern, text_lower)
            if match:
                location = match.group(1).strip()
                # Try to resolve
                if location in ALL_CITIES:
                    info = ALL_CITIES[location]
                    return info[0], info[1], info[2], info[3], info[4]
                if location in COUNTRY_NAMES:
                    info = COUNTRY_NAMES[location]
                    return info[0], info[1], None, None, None

        # Fall back to first mentioned city
        if cities:
            city = cities[0]
            if city in ALL_CITIES:
                info = ALL_CITIES[city]
                return info[0], info[1], info[2], info[3], info[4]

        # Fall back to first mentioned country
        if countries:
            country = countries[0]
            if country in COUNTRY_NAMES:
                info = COUNTRY_NAMES[country]
                return info[0], info[1], None, None, None

        return None, None, None, None, None

    def infer_expansion_targets(
        self, text: str, hq_city: Optional[str], cities: List[str]
    ) -> List[Tuple[str, str, Optional[str]]]:
        """
        Identify expansion target locations (distinct from HQ).
        Returns list of (country, country_code, city).
        """
        text_lower = text.lower()
        targets = []

        # Look for explicit expansion mentions
        expansion_patterns = [
            r"(?:expands?|expanding|enters?|entering|launches?\s+in|"
            r"opens?\s+(?:new\s+)?office\s+in|"
            r"(?:new|regional)\s+headquarters?\s+in)\s+"
            r"(\w[\w\s]*\w)",
        ]
        for pattern in expansion_patterns:
            for match in re.finditer(pattern, text_lower):
                location = match.group(1).strip()
                if location in ALL_CITIES:
                    info = ALL_CITIES[location]
                    # Skip if same as HQ
                    if hq_city and location == hq_city.lower():
                        continue
                    targets.append((info[0], info[1], info[2]))
                elif location in COUNTRY_NAMES:
                    info = COUNTRY_NAMES[location]
                    targets.append((info[0], info[1], None))

        # Deduplicate
        seen = set()
        unique = []
        for t in targets:
            key = (t[0], t[2])
            if key not in seen:
                seen.add(key)
                unique.append(t)

        return unique[:5]

    def extract(self, title: str, text: str) -> List[ExtractedEntity]:
        """
        Full entity extraction from an article.
        Returns a list of extracted company entities.
        """
        full_text = f"{title} {text}"
        companies = self.extract_company_names(full_text)
        cities, countries = self.extract_locations(full_text)
        funding = self.extract_funding(full_text)
        executives = self.extract_executives(full_text)

        hq_country, hq_code, hq_city, hq_lat, hq_lng = self.infer_headquarters(
            full_text, cities, countries
        )

        expansion_targets = self.infer_expansion_targets(
            full_text, hq_city, cities
        )

        entities = []
        for name in companies:
            entity = ExtractedEntity(
                name=name,
                headquarters_country=hq_country,
                headquarters_country_code=hq_code,
                headquarters_city=hq_city,
                headquarters_lat=hq_lat,
                headquarters_lng=hq_lng,
                expansion_countries=[t[0] for t in expansion_targets],
                expansion_cities=[t[2] for t in expansion_targets if t[2]],
                funding_usd=funding,
                executives=executives,
            )
            entities.append(entity)

        return entities

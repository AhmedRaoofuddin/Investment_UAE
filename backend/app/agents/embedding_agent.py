"""
Embedding Agent — Semantic relevance scoring using sentence-transformers.

Uses the all-MiniLM-L6-v2 model (22M params, 384-dim embeddings) for fast,
high-quality semantic similarity. Falls back to TF-IDF if the model is not
available (e.g. in CI or lightweight deployments).

Key capabilities:
  - Encode articles into dense vectors
  - Score relevance against UAE/MENA investment themes
  - Cluster similar articles for deduplication
  - Semantic search over the article corpus
"""
from __future__ import annotations

import logging
import hashlib
from typing import Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)

# UAE/MENA investment theme anchors — used for relevance scoring
UAE_INVESTMENT_THEMES = [
    "company expanding operations into the United Arab Emirates Dubai Abu Dhabi",
    "startup raises funding Series A B C venture capital investment round",
    "strategic partnership agreement signed between companies in Middle East",
    "new office opening regional headquarters in UAE MENA Gulf GCC",
    "technology company launches product service in Dubai Abu Dhabi",
    "regulatory approval license granted DIFC ADGM VARA financial authority",
    "merger acquisition deal completed in Middle East North Africa region",
    "executive appointment CEO CTO hire leadership change company growth",
    "cleantech renewable energy sustainability project UAE Net Zero 2050",
    "artificial intelligence AI machine learning company expansion",
    "fintech digital payments banking technology MENA region",
    "real estate development construction project UAE infrastructure",
    "logistics supply chain transport shipping ports Jebel Ali",
    "healthcare medical technology biotech pharmaceutical GCC",
    "manufacturing industrial production Make it in Emirates",
]

# Sector-specific embeddings for classification
SECTOR_DESCRIPTIONS = {
    "fintech": "financial technology digital payments banking blockchain cryptocurrency",
    "artificial_intelligence": "artificial intelligence machine learning deep learning AI neural network",
    "cleantech": "clean technology renewable energy solar wind sustainability green hydrogen",
    "healthcare": "healthcare medical biotech pharmaceutical genomics clinical trials",
    "logistics": "logistics supply chain shipping ports freight transportation warehouse",
    "real_estate": "real estate property development construction infrastructure urban planning",
    "ecommerce": "ecommerce online retail marketplace digital commerce platform",
    "manufacturing": "manufacturing industrial production factory assembly advanced materials",
    "energy": "energy oil gas petroleum LNG power generation utilities",
    "tourism": "tourism hospitality travel hotels entertainment leisure",
    "education": "education edtech learning university school training platform",
    "agritech": "agriculture technology farming food production vertical farming",
    "space": "space technology satellite launch aerospace orbital",
    "defense": "defense security military surveillance cybersecurity",
}


class EmbeddingAgent:
    """Manages text embeddings for semantic similarity and relevance scoring."""

    MODEL_NAME = "all-MiniLM-L6-v2"

    def __init__(self):
        self._model = None
        self._theme_embeddings: Optional[np.ndarray] = None
        self._sector_embeddings: Dict[str, np.ndarray] = {}
        self._cache: Dict[str, np.ndarray] = {}
        self._fallback_mode = False

    def _load_model(self):
        """Lazy-load the sentence-transformers model."""
        if self._model is not None:
            return
        try:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(self.MODEL_NAME)
            logger.info("embedding_model_loaded model=%s", self.MODEL_NAME)
        except ImportError:
            logger.warning(
                "sentence-transformers not installed. Using TF-IDF fallback. "
                "Install with: pip install sentence-transformers"
            )
            self._fallback_mode = True
        except Exception as exc:
            logger.warning("embedding_model_load_failed err=%s, using fallback", exc)
            self._fallback_mode = True

    def _encode_texts(self, texts: List[str]) -> np.ndarray:
        """Encode a list of texts into embedding vectors."""
        if self._fallback_mode or self._model is None:
            return self._hash_encode(texts)
        return self._model.encode(texts, normalize_embeddings=True, show_progress_bar=False)

    def _hash_encode(self, texts: List[str]) -> np.ndarray:
        """
        Deterministic hash-based encoding — always produces 384-dim vectors.
        Uses word hashing to create consistent sparse representations that
        enable meaningful cosine similarity without any ML model.
        """
        dim = 384
        embeddings = []
        for text in texts:
            words = text.lower().split()
            vec = np.zeros(dim)
            for w in words:
                # Multi-hash for better distribution
                h1 = int(hashlib.md5(w.encode()).hexdigest(), 16)
                h2 = int(hashlib.sha1(w.encode()).hexdigest(), 16)
                idx1 = h1 % dim
                idx2 = h2 % dim
                sign = 1.0 if (h1 >> 32) % 2 == 0 else -1.0
                vec[idx1] += sign
                vec[idx2] += 0.5 * sign
            # Add bigram features for better semantic capture
            for i in range(len(words) - 1):
                bigram = f"{words[i]}_{words[i+1]}"
                h = int(hashlib.md5(bigram.encode()).hexdigest(), 16)
                idx = h % dim
                vec[idx] += 0.7
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec /= norm
            embeddings.append(vec)
        return np.array(embeddings)

    def encode(self, text: str) -> np.ndarray:
        """Encode a single text, with caching."""
        self._load_model()
        cache_key = hashlib.sha256(text[:500].encode()).hexdigest()[:16]
        if cache_key in self._cache:
            return self._cache[cache_key]
        emb = self._encode_texts([text])[0]
        self._cache[cache_key] = emb
        return emb

    def encode_batch(self, texts: List[str]) -> np.ndarray:
        """Encode multiple texts efficiently."""
        self._load_model()
        return self._encode_texts(texts)

    def _get_theme_embeddings(self) -> np.ndarray:
        """Get or compute UAE investment theme embeddings."""
        if self._theme_embeddings is None:
            self._load_model()
            self._theme_embeddings = self._encode_texts(UAE_INVESTMENT_THEMES)
        return self._theme_embeddings

    def relevance_score(self, text: str) -> float:
        """
        Score how relevant an article is to UAE/MENA investment themes.
        Returns 0.0 to 1.0 (higher = more relevant).
        """
        article_emb = self.encode(text)
        theme_embs = self._get_theme_embeddings()
        # Cosine similarity (embeddings are already normalized)
        similarities = theme_embs @ article_emb
        # Take the max similarity across all themes
        max_sim = float(np.max(similarities))
        # Also compute mean of top-3 for a more robust score
        top3_mean = float(np.mean(np.sort(similarities)[-3:]))
        # Blend: 60% max, 40% top-3-mean
        score = 0.6 * max_sim + 0.4 * top3_mean
        # Normalize to 0-1 range (similarities are typically 0.1-0.8)
        return float(np.clip((score - 0.1) / 0.6, 0.0, 1.0))

    def sector_scores(self, text: str) -> Dict[str, float]:
        """
        Score which sectors an article is most related to.
        Returns dict of sector -> similarity score.
        """
        if not self._sector_embeddings:
            self._load_model()
            for sector, desc in SECTOR_DESCRIPTIONS.items():
                self._sector_embeddings[sector] = self.encode(desc)

        article_emb = self.encode(text)
        scores = {}
        for sector, sector_emb in self._sector_embeddings.items():
            sim = float(article_emb @ sector_emb)
            scores[sector] = float(np.clip(sim, 0.0, 1.0))
        return scores

    def top_sectors(self, text: str, threshold: float = 0.3, max_sectors: int = 3) -> List[str]:
        """Return the top matching sectors for a text, with keyword fallback."""
        # Try embedding-based first
        scores = self.sector_scores(text)
        ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        result = [s for s, score in ranked[:max_sectors] if score >= threshold]

        # If embeddings didn't produce results (common with hash fallback),
        # use keyword-based sector detection
        if not result:
            result = self._keyword_sector_detect(text, max_sectors)

        return result if result else ["other"]

    def _keyword_sector_detect(self, text: str, max_sectors: int = 3) -> List[str]:
        """Keyword-based sector detection as reliable fallback."""
        text_lower = text.lower()
        SECTOR_KEYWORDS = {
            "fintech": ["fintech", "payment", "banking", "bnpl", "neobank", "crypto", "blockchain", "defi", "digital wallet", "remittance"],
            "artificial_intelligence": ["artificial intelligence", " ai ", "machine learning", "deep learning", "neural", "llm", "generative ai", "computer vision", "nlp"],
            "cleantech": ["cleantech", "clean energy", "renewable", "solar", "wind", "hydrogen", "sustainability", "carbon", "net zero", "green energy", "ev ", "electric vehicle"],
            "healthcare": ["healthcare", "health tech", "biotech", "pharma", "medical", "genomics", "clinical", "hospital", "diagnostics", "telemedicine"],
            "logistics": ["logistics", "supply chain", "shipping", "freight", "port", "warehouse", "delivery", "fleet", "cargo", "transportation"],
            "real_estate": ["real estate", "property", "construction", "infrastructure", "housing", "development project", "urban planning", "tower", "building"],
            "ecommerce": ["ecommerce", "e-commerce", "marketplace", "online retail", "online shopping", "digital commerce", "food delivery", "cloud kitchen"],
            "manufacturing": ["manufacturing", "industrial", "factory", "production", "steel", "assembly", "fabrication", "materials"],
            "energy": ["energy", "oil", "gas", "petroleum", "lng", "power", "utility", "fuel", "opec", "adnoc"],
            "tourism": ["tourism", "hospitality", "travel", "hotel", "resort", "entertainment", "leisure", "theme park", "waterworld"],
            "education": ["education", "edtech", "university", "school", "training", "learning platform", "academic"],
            "agritech": ["agritech", "agriculture", "farming", "food tech", "vertical farm", "food security"],
            "space": ["space", "satellite", "aerospace", "orbital", "launch vehicle", "rocket"],
            "defense": ["defense", "defence", "security", "military", "surveillance", "cybersecurity", "cyber"],
        }
        matches = []
        for sector, keywords in SECTOR_KEYWORDS.items():
            count = sum(1 for kw in keywords if kw in text_lower)
            if count > 0:
                matches.append((sector, count))
        matches.sort(key=lambda x: x[1], reverse=True)
        return [s for s, _ in matches[:max_sectors]]

    def deduplicate(
        self, texts: List[str], threshold: float = 0.92
    ) -> List[int]:
        """
        Find near-duplicate texts using embedding similarity.
        Returns indices of unique (non-duplicate) texts.
        """
        if len(texts) <= 1:
            return list(range(len(texts)))

        embeddings = self.encode_batch(texts)
        sim_matrix = embeddings @ embeddings.T
        unique_indices = []
        seen = set()

        for i in range(len(texts)):
            if i in seen:
                continue
            unique_indices.append(i)
            for j in range(i + 1, len(texts)):
                if sim_matrix[i, j] >= threshold:
                    seen.add(j)

        return unique_indices

    def semantic_search(
        self, query: str, corpus: List[str], top_k: int = 10
    ) -> List[Tuple[int, float]]:
        """
        Search a corpus for the most similar texts to a query.
        Returns list of (index, similarity_score) tuples.
        """
        query_emb = self.encode(query)
        corpus_embs = self.encode_batch(corpus)
        similarities = corpus_embs @ query_emb
        top_indices = np.argsort(similarities)[::-1][:top_k]
        return [(int(idx), float(similarities[idx])) for idx in top_indices]

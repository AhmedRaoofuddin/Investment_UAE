# Graph Report - C:\Users\META\Desktop\New\investuae-signals  (2026-04-20)

## Corpus Check
- 166 files · ~520,227 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 817 nodes · 1646 edges · 98 communities detected
- Extraction: 50% EXTRACTED · 50% INFERRED · 0% AMBIGUOUS · INFERRED: 829 edges (avg confidence: 0.64)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 90|Community 90]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 95|Community 95]]
- [[_COMMUNITY_Community 96|Community 96]]
- [[_COMMUNITY_Community 97|Community 97]]

## God Nodes (most connected - your core abstractions)
1. `EmbeddingAgent` - 64 edges
2. `EntityAgent` - 56 edges
3. `GET()` - 56 edges
4. `ScoringAgent` - 52 edges
5. `ClassifierAgent` - 51 edges
6. `Company` - 45 edges
7. `Signal` - 33 edges
8. `SourceArticle` - 31 edges
9. `POST()` - 31 edges
10. `PipelineOrchestrator` - 30 edges

## Surprising Connections (you probably didn't know these)
- `Run the live signal detection pipeline using open-source ML agents.  This script` --uses--> `PipelineOrchestrator`  [INFERRED]
  C:\Users\META\Desktop\New\investuae-signals\backend\run_pipeline.py → C:\Users\META\Desktop\New\investuae-signals\backend\app\agents\orchestrator.py
- `Classifies articles into investment signal types.` --uses--> `EmbeddingAgent`  [INFERRED]
  C:\Users\META\Desktop\New\investuae-signals\backend\app\agents\classifier_agent.py → C:\Users\META\Desktop\New\investuae-signals\backend\app\agents\embedding_agent.py
- `Try to load the zero-shot classification pipeline.` --uses--> `EmbeddingAgent`  [INFERRED]
  C:\Users\META\Desktop\New\investuae-signals\backend\app\agents\classifier_agent.py → C:\Users\META\Desktop\New\investuae-signals\backend\app\agents\embedding_agent.py
- `Fast keyword-based classification with regex patterns.` --uses--> `EmbeddingAgent`  [INFERRED]
  C:\Users\META\Desktop\New\investuae-signals\backend\app\agents\classifier_agent.py → C:\Users\META\Desktop\New\investuae-signals\backend\app\agents\embedding_agent.py
- `Classify using embedding similarity to signal type descriptions.` --uses--> `EmbeddingAgent`  [INFERRED]
  C:\Users\META\Desktop\New\investuae-signals\backend\app\agents\classifier_agent.py → C:\Users\META\Desktop\New\investuae-signals\backend\app\agents\embedding_agent.py

## Communities

### Community 0 - "Community 0"
Cohesion: 0.03
Nodes (54): doSignIn(), doSignUp(), audit(), getConnector(), buildConnectionId(), createConnectSession(), deleteNangoConnection(), isNangoConfigured() (+46 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (77): BaseModel, _build_extraction_user_prompt(), _company_id(), deep_dive_company(), _extract_batch(), extract_signals_and_companies(), _looks_relevant(), _merge_company_keys() (+69 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (34): EntityAgent, ExtractedEntity, _looks_like_company_name(), Entity Extraction Agent — Extracts companies, locations, and funding from text., A company entity extracted from text., Extracts structured entities from news article text., Extract the largest funding amount mentioned in text., Extract mentioned cities and countries from text.         Returns (cities_found, (+26 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (34): Classifier Agent — Zero-shot signal type classification.  Uses either:   1. Tran, Result of signal classification for an article., SignalClassification, EmbeddingAgent, Embedding Agent — Semantic relevance scoring using sentence-transformers.  Uses, Encode a single text, with caching., Encode multiple texts efficiently., Get or compute UAE investment theme embeddings. (+26 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (21): ClassifierAgent, Classifies articles into investment signal types., Try to load the zero-shot classification pipeline., Fast keyword-based classification with regex patterns., Classify using embedding similarity to signal type descriptions., Classify using the transformers zero-shot pipeline., Determine signal strength based on content analysis., Classify an article text into signal type with confidence.          Uses ML mode (+13 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (20): Optionally load embedding agent for semantic scoring., Compute investability score from company data., Compute UAE alignment score., Score a company on investability and UAE alignment.          Args:             s, Score multiple companies., Generate a brief investment thesis snippet., Scores companies for investability and UAE alignment., ScoringAgent (+12 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (21): is_sanctioned(), _normalise(), Sanctions + PEP screening.  Ministry-grade investment platforms MUST NOT surface, Bundled sanctions + PEP screener.      The screener operates on normalised forms, Return every hit found inside `needle`. Callers decide how to         handle mul, Convenience: True if any SDN/UN/EU hit (confidence ≥ 0.9)., Module-level shortcut used by the pipeline orchestrator., Fold diacritics + collapse whitespace + lowercase.     Required so the matcher c (+13 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (15): redact(), Invest UAE — AI Agent Modules  Open-source ML agents for investment signal detec, PIIRedactor, PII redaction for outgoing signals.  Every signal surfaced to an analyst, pushed, Swappable redactor so tests can assert on exact counts., RedactionResult, PII redaction.  Every outgoing signal passes through `redact`. Failure here = PD, Redaction MUST NOT destroy the surrounding narrative. A signal     body "X raise (+7 more)

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (17): InjectionFinding, InjectionGuard, Prompt-injection detection for untrusted text before it reaches the LLM.  The si, Stateful scanner so rule-sets can be swapped in tests without monkey-     patchi, Return every matching finding. Empty list means the text is         safe to conc, scan_untrusted(), Prompt-injection scanning.  Every article body concatenated into an LLM prompt M, End-to-end check: the conftest adversarial fixture MUST be         caught. If th (+9 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (11): formatUsd(), cn(), t(), cn(), localizedSector(), onRefresh(), formatNumber(), formatUsd() (+3 more)

### Community 10 - "Community 10"
Cohesion: 0.14
Nodes (11): PipelineCache, File-backed cache for pipeline results, with TTL. Avoids re-running the full RSS, Single global cache slot for the latest companies snapshot., main(), Run the live signal detection pipeline using open-source ML agents.  This script, _make_company(), Pipeline cache behaviour.  The cache serves every `GET /api/companies` hit. TTL, Minimal valid Company for cache round-trip tests. (+3 more)

### Community 11 - "Community 11"
Cohesion: 0.1
Nodes (24): _env_int(), _env_str(), get_settings(), Application configuration loaded from environment variables. Pydantic-settings p, Settings, _configure_logging(), lifespan(), FastAPI entry point for the Invest UAE Signal Detection backend. (+16 more)

### Community 12 - "Community 12"
Cohesion: 0.16
Nodes (17): Hard-refusal guard for regulated activity.  The Ministry's signal detection tool, Swappable refusal rule-set so policy updates are unit-testable., RefusalDecision, RegulatedActivityGuard, should_refuse(), TestOutOfScopeQueryRefused, Regulated-activity refusal guard.  The tool MUST refuse to generate personalised, A swappable guard lets ops tighten policy without redeploy. (+9 more)

### Community 13 - "Community 13"
Cohesion: 0.11
Nodes (10): Lightweight country / city → coordinates lookup for MENA + global hubs. Used to, Best-effort coordinate lookup. Returns a CompanyLocation, possibly empty., resolve_location(), Geo-enricher — pure-Python centroid resolver.  Tests guard against silent coordi, Dubai, Saudi Arabia' is obviously wrong input — the city         has primacy. Th, Coverage assertions. If these shrink, Ministry-critical regions     start droppi, TestCatalogueIntegrity, TestCityResolution (+2 more)

### Community 14 - "Community 14"
Cohesion: 0.18
Nodes (7): funding_article(), noise_article(), prompt_injection_article(), Shared pytest fixtures.  Every test runs fully offline. Fixtures bundled here ar, An adversarial article body designed to steer an LLM. Every safety     test that, A prototypical MENA fundraising article. Used to assert that the     classifier, Content that is demonstrably NOT an investment signal. The     classifier should

### Community 15 - "Community 15"
Cohesion: 0.25
Nodes (0): 

### Community 16 - "Community 16"
Cohesion: 0.39
Nodes (6): chat(), hashShort(), modelFor(), guardInput(), scrubOutput(), shouldRefuse()

### Community 17 - "Community 17"
Cohesion: 0.39
Nodes (6): generateNonce(), securityHeaders(), clientIp(), hasSessionCookie(), middleware(), tooManyRequests()

### Community 18 - "Community 18"
Cohesion: 0.6
Nodes (5): _flatten_signals(), _ingest_key(), _ingest_url(), publish_signals_to_workspace(), _strength_to_str()

### Community 19 - "Community 19"
Cohesion: 0.47
Nodes (3): base64url(), challengeFromVerifier(), generateCodeVerifier()

### Community 20 - "Community 20"
Cohesion: 0.6
Nodes (3): handleSave(), submitting(), t()

### Community 21 - "Community 21"
Cohesion: 0.83
Nodes (3): severityLabel(), t(), timeAgo()

### Community 22 - "Community 22"
Cohesion: 0.67
Nodes (0): 

### Community 23 - "Community 23"
Cohesion: 0.67
Nodes (0): 

### Community 24 - "Community 24"
Cohesion: 1.0
Nodes (2): base(), request()

### Community 25 - "Community 25"
Cohesion: 0.67
Nodes (0): 

### Community 26 - "Community 26"
Cohesion: 0.67
Nodes (0): 

### Community 27 - "Community 27"
Cohesion: 0.67
Nodes (0): 

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Community 31"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Community 32"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Community 39"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Community 41"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Community 43"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Community 44"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Community 45"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Community 46"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Community 47"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Community 48"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "Community 49"
Cohesion: 1.0
Nodes (0): 

### Community 50 - "Community 50"
Cohesion: 1.0
Nodes (0): 

### Community 51 - "Community 51"
Cohesion: 1.0
Nodes (0): 

### Community 52 - "Community 52"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "Community 53"
Cohesion: 1.0
Nodes (1): Reject obvious sentence fragments that the regex patterns         sometimes capt

### Community 54 - "Community 54"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "Community 55"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "Community 56"
Cohesion: 1.0
Nodes (0): 

### Community 57 - "Community 57"
Cohesion: 1.0
Nodes (0): 

### Community 58 - "Community 58"
Cohesion: 1.0
Nodes (0): 

### Community 59 - "Community 59"
Cohesion: 1.0
Nodes (0): 

### Community 60 - "Community 60"
Cohesion: 1.0
Nodes (0): 

### Community 61 - "Community 61"
Cohesion: 1.0
Nodes (0): 

### Community 62 - "Community 62"
Cohesion: 1.0
Nodes (0): 

### Community 63 - "Community 63"
Cohesion: 1.0
Nodes (0): 

### Community 64 - "Community 64"
Cohesion: 1.0
Nodes (0): 

### Community 65 - "Community 65"
Cohesion: 1.0
Nodes (0): 

### Community 66 - "Community 66"
Cohesion: 1.0
Nodes (0): 

### Community 67 - "Community 67"
Cohesion: 1.0
Nodes (0): 

### Community 68 - "Community 68"
Cohesion: 1.0
Nodes (0): 

### Community 69 - "Community 69"
Cohesion: 1.0
Nodes (0): 

### Community 70 - "Community 70"
Cohesion: 1.0
Nodes (0): 

### Community 71 - "Community 71"
Cohesion: 1.0
Nodes (0): 

### Community 72 - "Community 72"
Cohesion: 1.0
Nodes (0): 

### Community 73 - "Community 73"
Cohesion: 1.0
Nodes (0): 

### Community 74 - "Community 74"
Cohesion: 1.0
Nodes (0): 

### Community 75 - "Community 75"
Cohesion: 1.0
Nodes (0): 

### Community 76 - "Community 76"
Cohesion: 1.0
Nodes (0): 

### Community 77 - "Community 77"
Cohesion: 1.0
Nodes (0): 

### Community 78 - "Community 78"
Cohesion: 1.0
Nodes (0): 

### Community 79 - "Community 79"
Cohesion: 1.0
Nodes (0): 

### Community 80 - "Community 80"
Cohesion: 1.0
Nodes (0): 

### Community 81 - "Community 81"
Cohesion: 1.0
Nodes (0): 

### Community 82 - "Community 82"
Cohesion: 1.0
Nodes (0): 

### Community 83 - "Community 83"
Cohesion: 1.0
Nodes (0): 

### Community 84 - "Community 84"
Cohesion: 1.0
Nodes (0): 

### Community 85 - "Community 85"
Cohesion: 1.0
Nodes (0): 

### Community 86 - "Community 86"
Cohesion: 1.0
Nodes (0): 

### Community 87 - "Community 87"
Cohesion: 1.0
Nodes (0): 

### Community 88 - "Community 88"
Cohesion: 1.0
Nodes (0): 

### Community 89 - "Community 89"
Cohesion: 1.0
Nodes (0): 

### Community 90 - "Community 90"
Cohesion: 1.0
Nodes (0): 

### Community 91 - "Community 91"
Cohesion: 1.0
Nodes (0): 

### Community 92 - "Community 92"
Cohesion: 1.0
Nodes (0): 

### Community 93 - "Community 93"
Cohesion: 1.0
Nodes (0): 

### Community 94 - "Community 94"
Cohesion: 1.0
Nodes (0): 

### Community 95 - "Community 95"
Cohesion: 1.0
Nodes (0): 

### Community 96 - "Community 96"
Cohesion: 1.0
Nodes (0): 

### Community 97 - "Community 97"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **51 isolated node(s):** `One-shot script to generate realistic seed data for the pipeline cache.`, `Application configuration loaded from environment variables. Pydantic-settings p`, `FastAPI entry point for the Invest UAE Signal Detection backend.`, `Embedding Agent — Semantic relevance scoring using sentence-transformers.  Uses`, `Manages text embeddings for semantic similarity and relevance scoring.` (+46 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 28`** (2 nodes): `layout.tsx`, `RootLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (2 nodes): `not-found.tsx`, `NotFound()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (2 nodes): `layout.tsx`, `MarketingLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (2 nodes): `page.tsx`, `HomePage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (2 nodes): `page.tsx`, `ReportsPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (2 nodes): `page.tsx`, `MiniStat()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (2 nodes): `layout.tsx`, `PlatformLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (2 nodes): `page.tsx`, `fetchOverview()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (2 nodes): `loading.tsx`, `CompanyLoading()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (2 nodes): `loading.tsx`, `SectorsLoading()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (2 nodes): `page.tsx`, `SignInPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (2 nodes): `page.tsx`, `SignUpPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (2 nodes): `WorkspaceNav.tsx`, `WorkspaceNav()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (2 nodes): `layout.tsx`, `PaddedLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (2 nodes): `DashboardView.tsx`, `fetcher()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (2 nodes): `Logo.tsx`, `Logo()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (2 nodes): `HeroCarousel.tsx`, `goto()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (2 nodes): `StatsBar.tsx`, `tick()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (2 nodes): `SignalCard.tsx`, `truncate()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (2 nodes): `score-pill.tsx`, `ScorePill()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (2 nodes): `NangoConnectButton.tsx`, `NangoConnectButton()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (2 nodes): `RefreshPipelineButton.tsx`, `handleRefresh()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (2 nodes): `notion.ts`, `ready()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (2 nodes): `slack.ts`, `ready()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (1 nodes): `Reject obvious sentence fragments that the regex patterns         sometimes capt`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 58`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 59`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 62`** (1 nodes): `eslint.config.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 63`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64`** (1 nodes): `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 65`** (1 nodes): `postcss.config.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 67`** (1 nodes): `loading.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 68`** (1 nodes): `loading.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 69`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 70`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 71`** (1 nodes): `loading.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 72`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 73`** (1 nodes): `loading.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 74`** (1 nodes): `route.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 75`** (1 nodes): `SignInForm.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 76`** (1 nodes): `SignUpForm.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 77`** (1 nodes): `Footer.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 78`** (1 nodes): `CtaBand.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 79`** (1 nodes): `HowItWorks.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 80`** (1 nodes): `OpportunityShowcase.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 81`** (1 nodes): `PartnersStrip.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 82`** (1 nodes): `PlatformPreview.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 83`** (1 nodes): `PrincipalsBlock.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 84`** (1 nodes): `SourceMarquee.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 85`** (1 nodes): `EmptyState.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 86`** (1 nodes): `GeoMap.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 87`** (1 nodes): `Pagination.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 88`** (1 nodes): `auth.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 89`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 90`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 91`** (1 nodes): `adx.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 92`** (1 nodes): `mcpFilesystem.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 93`** (1 nodes): `dictionary.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 94`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 95`** (1 nodes): `inApp.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 96`** (1 nodes): `slack.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 97`** (1 nodes): `migrate-or-skip.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GET()` connect `Community 0` to `Community 1`, `Community 2`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 10`, `Community 11`, `Community 17`?**
  _High betweenness centrality (0.245) - this node is a cross-community bridge._
- **Why does `Invest UAE — AI Agent Modules  Open-source ML agents for investment signal detec` connect `Community 7` to `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 8`, `Community 12`?**
  _High betweenness centrality (0.103) - this node is a cross-community bridge._
- **Why does `EmbeddingAgent` connect `Community 3` to `Community 1`, `Community 4`, `Community 5`, `Community 7`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._
- **Are the 49 inferred relationships involving `EmbeddingAgent` (e.g. with `SignalClassification` and `ClassifierAgent`) actually correct?**
  _`EmbeddingAgent` has 49 INFERRED edges - model-reasoned connections that need verification._
- **Are the 45 inferred relationships involving `EntityAgent` (e.g. with `PipelineMode` and `PipelineOrchestrator`) actually correct?**
  _`EntityAgent` has 45 INFERRED edges - model-reasoned connections that need verification._
- **Are the 49 inferred relationships involving `GET()` (e.g. with `lifespan()` and `._zeroshot_classify()`) actually correct?**
  _`GET()` has 49 INFERRED edges - model-reasoned connections that need verification._
- **Are the 43 inferred relationships involving `ScoringAgent` (e.g. with `PipelineMode` and `PipelineOrchestrator`) actually correct?**
  _`ScoringAgent` has 43 INFERRED edges - model-reasoned connections that need verification._
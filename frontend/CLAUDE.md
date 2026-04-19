# Invest UAE — AI Signal Detection Platform

## Tooling: graphify

**graphify** (https://github.com/safishamsi/graphify.git) is the user's preferred knowledge-graph layer for this codebase. It scans the repo, extracts structure/relationships across code + docs + images + videos, and writes the result to `graphify-out/` (interactive HTML graph, markdown report, queryable `graph.json`, incremental cache).

**Workflow I should follow on non-trivial tasks**:
1. Before spelunking through `frontend/` or `backend/` with Grep / Glob / Explore, check whether `graphify-out/graph.json` + the markdown report exist at the repo root. If they do, **read them first** — they encode file relationships, component ownership, and architectural clusters more densely than raw file crawling.
2. The graphify Claude Code hook (installed via `graphify claude install`) injects a PreToolUse reminder to consult the graph before reading raw files. If that hook is active in the user's environment, honour it: summary → targeted reads, not broad Grep sweeps.
3. If `graphify-out/` is missing or stale (older than the last significant architectural change), suggest the user re-run `graphify .` (or `graphify . --update` for incremental) before I tackle anything that spans ≥ 3 files.

**Install**: `pip install graphifyy && graphify install` (note the double-y on the pip name; CLI command is `graphify`).
**Scan this repo**: `graphify .` from the investuae-signals root.
**Modes**: `--mode deep` for denser semantic extraction on unfamiliar codebases; `--watch` for ambient re-scan during active development.

Token-efficiency claim from the repo: ~71× fewer tokens per navigation query vs reading raw files on large corpora. Worth the setup for this project given the 25+ page frontend + FastAPI backend + dictionary-driven i18n layer.



## Project Overview
AI-powered investment signal detection tool for the UAE Ministry of Investment. 
Scans 18+ MENA/global RSS news sources, extracts investment signals (funding, expansion, partnership, M&A, regulatory, launch, hiring, executive), scores companies on investability and UAE alignment, and presents a ranked pipeline through a Next.js frontend.

## Architecture

### Frontend (this directory)
- **Framework**: Next.js 16.2.3 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS 4 + custom brand tokens in `globals.css`
- **Charts**: Recharts | **Maps**: Leaflet + react-leaflet | **Animations**: Framer Motion
- **Fonts**: Inter (sans) + Fraunces (serif) from Google Fonts

### Backend (`../backend/`)
- **Framework**: FastAPI + Uvicorn
- **ML Agents** (`app/agents/`): 4 open-source agents (embedding, classifier, entity, scoring) + orchestrator
- **Claude API**: Optional enhancement layer (not required — ML agents work standalone)
- **Data**: RSS feeds from 18+ sources defined in `data/sources.yaml`

## Deployed URLs
| Service | URL |
|---------|-----|
| Frontend | https://frontend-iota-seven-30.vercel.app |
| Backend API | https://backend-lyart-three-63.vercel.app |
| API Docs | https://backend-lyart-three-63.vercel.app/docs |

## Key Files

### Frontend Routes
- `/` — Home page with hero carousel, stats, how-it-works
- `/why-invest` — Investment pillars (geography, capital, AI, free zones, talent)
- `/about` — Ministry and platform info
- `/reports` — Ministry PDF publications + official data sources
- `/platform` — Dashboard overview with KPIs
- `/platform/signals` — Live signal feed with type/strength filters
- `/platform/companies` — Company pipeline with search, sector/region filters, scoring
- `/platform/companies/[id]` — Company dossier (deep-dive)
- `/platform/geo` — Leaflet satellite map with geo-tagged companies
- `/platform/sectors` — Sector analytics with charts and table

### Key Components
- `components/layout/Header.tsx` — Sticky header with desktop nav dropdowns, mobile hamburger menu, search overlay (Ctrl+K)
- `components/layout/Footer.tsx` — 4-column footer with all internal links (no `href="#"`)
- `components/brand/Logo.tsx` — Renders the official Ministry dual-logo SVG (`public/brand/dual-logo-official.svg`, fetched verbatim from investuae.gov.ae). Single source asset; `variant="light"` tints to white via `brightness-0 invert` for dark backgrounds. Responsive heights: `h-10 sm:h-12 lg:h-14`.
- `components/marketing/SourceMarquee.tsx` — Dark-navy infinite-scroll strip of the **16 news/data sources we actually scrape**. Each entry uses its real publisher favicon on a small white tile so the brand reads against the navy background. This makes a *signal-detection* claim about the platform — keep distinct from `PartnersStrip` (which is the Ministry's commercial advisory partners).
- `components/marketing/PartnersStrip.tsx` — Light marquee of the **20 advisory firms** the Ministry lists under "Key Partners" (KPMG, EY, PwC, BDO, Strategy&, FTI, JLL, Cushman, Korn Ferry, Al Tamimi, Galadari, Herbert Smith, Habib Al Mulla, ADG Legal, IQVIA, Palladium, Cooper Fitch, Creative Zone, TGC, Lancer). Uniform white-card tiles, hover scale, "View all" goes to the Ministry's own `/en/partners` page. Mirrors their visual treatment using the existing CSS-only `marquee-track` keyframe (no Swiper dependency).
- `components/platform/PlatformShell.tsx` — Sub-nav + page header with the context-aware **Refresh** button. On dossier routes (`/platform/companies/[id]`) the button label switches to "Regenerate Analysis" and calls `router.refresh()` (re-runs the dossier server component → one Opus call to `/api/companies/{id}`). On all other platform routes it calls `api.refresh()` (full pipeline rerun).
- `components/platform/GeoMap.tsx` — Leaflet map with sapphire/purple markers (visible on desert satellite imagery)
- `components/platform/SignalCard.tsx` — Signal card with source link + Google search fallback
- `components/platform/EmptyState.tsx` — Used by the dossier page when a company id 404s (stale link after a pipeline re-run); also the generic empty state on signals/companies/sectors/geo when SWR returns no data.
- `components/ui/primitives.tsx` — Button, Card, Badge, Section, Eyebrow, SerifHeading

### Backend Agents (`../backend/app/agents/`)
- `embedding_agent.py` — Hash-based semantic encoding (384-dim), sentence-transformers upgradeable
- `classifier_agent.py` — Hybrid signal classification (regex + embedding similarity)
- `entity_agent.py` — Company/location/funding extraction (50+ city gazetteer)
- `scoring_agent.py` — Multi-factor scoring aligned to UAE National Strategy
- `orchestrator.py` — 6-stage pipeline: Filter → Classify → Extract → Aggregate → Score → Rank

### Backend API Endpoints
- `GET /api/health` — Health check + cache info
- `GET /api/companies` — Filtered company list (sector, region, min_score, q, limit)
- `GET /api/companies/{id}` — Company deep-dive dossier
- `GET /api/sectors` — Sector aggregates
- `GET /api/geo` — Geo points for map
- `POST /api/refresh` — Force pipeline re-run

## Environment Variables

### Frontend (.env.local)
```
BACKEND_URL=https://backend-lyart-three-63.vercel.app
NEXT_PUBLIC_BACKEND_URL=/api/proxy
```

### Backend (.env)
```
ANTHROPIC_API_KEY=<optional>
CLAUDE_MODEL_FAST=claude-haiku-4-5-20251001
CLAUDE_MODEL_DEEP=claude-opus-4-6
LOOKBACK_DAYS=90
MAX_ARTICLES_PER_FEED=80
PARALLEL_FETCHES=12
CACHE_TTL_HOURS=6
ALLOWED_ORIGIN=http://localhost:3000
```

## Running Locally

### Backend
```bash
cd backend
python -m venv .venv && .venv/Scripts/activate
pip install -r requirements.txt
python run_pipeline.py          # Fetch real data from RSS feeds
uvicorn app.main:app --port 8001
```

### Frontend
```bash
cd frontend
npm install
# Set BACKEND_URL=http://127.0.0.1:8001 in .env.local
npm run dev
```

## Brand Tokens
- Navy: #08152C (900) → #F1F4FA (50)
- Gold: #3D2E18 (900) → #FBF6EC (50)
- Sand: #FDFCF8 (50), Sand-100 as background
- Map markers: Sapphire (#1B4F72), Purple (#7B2D8E), White (emerging)

## Mobile Responsiveness
All pages are mobile-responsive (tested at 375px). Key patterns:
- Header: hamburger menu on `< lg`, search overlay works at all sizes
- Grids: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` pattern throughout
- Platform tabs: horizontal scroll with `scrollbar-hide`
- Tables: `overflow-x-auto` with `min-w-[640px]`
- Padding: `px-4 sm:px-6 lg:px-10` standard spacing

## Brand Assets (`public/brand/`)
- `dual-logo-official.svg` — 96 KB, official Ministry of Investment dual-mark fetched verbatim from `https://www.investuae.gov.ae/assets/DualLogo-msm_G2uG.svg`. Native viewBox `0 0 989.45 482.5` (~2.05:1). Used by `<Logo>` in header + footer.
- `favicon.svg` (legacy) — Original navy shield with gold lines. Superseded.
- `app/icon.svg` — Eagle-only crop of the official dual logo (viewBox `185 35 175 270`). Picked up automatically by Next.js as the high-res favicon for modern browsers.
- `app/favicon.ico` — 1.1 KB, 16×16, copied from the Ministry's own `/favicon.ico`. Fallback for older browsers.

## Logo Assets — News Sources (`public/sources/`)
- 16 publisher favicons mirrored locally so the `SourceMarquee` shows real brand marks (not placeholder bullets). One file per outlet: `wamda.png`, `magnitt.png`, `menabytes.png`, `the-national.jpeg`, `khaleej-times.png`, `gulf-news.png`, `arabian-business.png`, `gulf-business.png`, `zawya.png`, `fast-company-me.png`, `economy-me.png`, `reuters.png`, `techcrunch.png`, `sifted.png`, `crunchbase.png`, `venturebeat.png`.
- Sourced first from each site's `apple-touch-icon` link, falling back to Google's `t2.gstatic.com/faviconV2?size=128`. Sizes range 16–180 px; the marquee renders them inside a uniform white tile so the small ones still read against the navy background.

## Logo Assets — Partners (`public/partners/`)
- 20 advisory-firm logos mirrored verbatim from the Ministry's own `https://www.investuae.gov.ae/storage/post/<hash>.jpg` URLs (the same artwork it uses on its homepage Partners carousel).
- Source of truth: `GET https://website-api.investuae.gov.ae/api/v1/data/en/partners` → `body.partnersCategories[0].partners` (category "Key Partners"; the API actually returns 22 entries but two are EY/KPMG duplicates so we ship 20).
- Files use lowercase-kebab slugs: `galadari.jpg`, `al-tamimi.jpg`, `herbert.jpg`, `habib.jpg`, `adg-legal.jpg`, `ey.jpg`, `iqvia.jpg`, `strategy-and.jpg`, `fti-consulting.jpg`, `kpmg.jpg`, `palladium.jpg`, `cushman.jpg`, `jll.jpg`, `bdo.jpg`, `pwc.jpg`, `korn-ferry.jpg`, `cooper-fitch.jpg`, `creative-zone.jpg`, `tgc.jpg`, `lancer.jpg`.

## Reports Page
- `app/(marketing)/reports/page.tsx` is a **server component** with URL-driven pagination (`/reports?page=N`).
- Source of truth: 12 entries hand-curated from the Ministry's open-data API at `https://website-api.investuae.gov.ae/api/v1/data/en/open-data?page=1`. Each `download_url` is a `https://www.investuae.gov.ae/storage/post/<hash>.pdf` that has been independently HEAD-verified to return `application/pdf` (700 KB – 20 MB).
- **Avoid** the legacy `/assets/<filename>.pdf` path scheme — those URLs return the SPA shell (HTML 200) and the gview-based "View Report" wrapper falls back to the marketing site instead of opening the PDF. Both "View Report" and "Download PDF" now point straight at the PDF URL.
- Pagination: `PAGE_SIZE = 6` ⇒ 2 pages of 6. Active page highlighted, prev/next disabled at boundaries, "Showing N–M of 12" indicator, fully wrap-friendly on mobile.

## Backend Deployment Notes
- `backend/vercel.json` declares the FastAPI app via `@vercel/python` with a 50 MB lambda cap.
- `backend/.vercelignore` excludes `.env*` and `notebooks/`. **Do NOT add `cache/` to the ignore** — `app/config.py` runs `CACHE_DIR.mkdir(parents=True, exist_ok=True)` at import time and Vercel's filesystem is read-only outside `/tmp`, so the directory must exist in the bundle.
- `backend/app/config.py` calls `load_dotenv(..., override=False)` so platform-provided env vars (Vercel, Docker) always win over any `.env` that slips into the bundle.
- All env vars from `backend/.env` (including `ANTHROPIC_API_KEY`) must be set in the Vercel project's production environment via `vercel env add`. The dashboard at https://vercel.com/sysadmin-netizens-projects/backend/settings/environment-variables is the source of truth.

## Known Failure Modes & Diagnostics
- **"Backend unreachable" empty state** on platform pages: SWR-side error handler — fires on *any* non-OK response, including 4xx contract mismatches. The page text suggests starting uvicorn locally; in production it usually means a query-param validation error (e.g. requesting `limit > 200` against `/api/companies`).
- **"Thesis pending. Refresh the pipeline to generate analysis."** on a dossier: the per-company Opus call in `claude_signal_extractor.deep_dive_company` returned `("", [], [])`. Root causes seen in the wild:
  - Anthropic API returning 400 `invalid_request_error` with `"Your credit balance is too low"` — a **prepaid balance** issue on the workspace owning the API key, NOT an issue with the key itself or the deployed code. Fix by topping up at https://console.anthropic.com/settings/billing on the same workspace.
  - `ANTHROPIC_API_KEY` missing from Vercel env — `get_settings().anthropic_api_key` ends up empty, `AsyncAnthropic` instantiates fine but every request 401s.
- **404 on a dossier URL after Refresh Pipeline**: company IDs are deterministic on the LLM-extracted name (`co_<slug>_<6-char-sha>`); a re-run can produce a different name and orphan the old id. The dossier page now renders an in-platform `EmptyState` ("Company not in current pipeline") instead of `notFound()`-ing to the marketing 404.

## Workspace v2 — Investor Workspace (Apr 2026)

A second product surface lives under `/workspace`, gated by Auth.js v5
magic-link sign-in. Its activation needs Postgres + a handful of secrets;
see [INSTALL.md](./INSTALL.md) for the credential checklist. While dormant,
it doesn't affect the marketing or platform pages.

### Architecture summary

```
                ┌── /          (marketing — RSC)
                ├── /platform  (signal demo — existing pipeline)
                ├── /reports   (Ministry PDFs)
                ├── /auth/*    (magic-link sign-in)
                └── /workspace (authed)
                        │
                        ├── overview     KPI tiles
                        ├── connections  catalogue + connect/revoke
                        ├── watchlist    per-tenant CRUD
                        └── notifications inbox

middleware.ts  →  CSP nonce + HSTS + rate-limit + cookie auth gate
lib/db.ts      →  Prisma singleton (lazy-init; isDbConfigured guard)
lib/auth.ts    →  Auth.js v5 with PrismaAdapter, db sessions, magic-link
lib/audit.ts   →  fire-and-forget append-only audit log
lib/security/  →  encryption (AES-256-GCM, HKDF per-tenant DEK)
                  headers (CSP / HSTS / Trusted Types / Permissions-Policy)
                  rateLimit (token bucket)
                  session (requireSession / getSessionOrNull)
lib/ai/        →  guardrails (prompt-injection + secret + PII regex)
                  client (audited Anthropic wrapper — single source of truth)
lib/connections/  registry → providers/*  (Drive, Notion, Slack, MCP, ADX)
                  service (encrypted token vault, upsert/revoke)
lib/notifications/ types + service + channels/* (in-app, email, slack, whatsapp)
prisma/schema  →  Tenant, User, Account, Session, Connection, ConnectionSecret,
                  WatchlistItem, Notification, AuditEntry
```

### Security guarantees in this codebase

- **No third-party access tokens in plaintext anywhere.** All OAuth /
  API-key secrets pass through `sealSecret` (AES-256-GCM, per-tenant DEK
  via HKDF over `TOKEN_VAULT_MASTER_KEY`) before hitting the DB.
- **No JWTs in the browser.** Database session strategy; the cookie carries
  an opaque session id only.
- **Tenant isolation enforced at every query.** Helpers expose
  `requireSession()` returning `tenantId`; every Prisma WHERE includes it.
  No cross-tenant joins.
- **All LLM calls audited.** Direct use of `@anthropic-ai/sdk` is banned
  outside `lib/ai/client.ts`. Every call writes an `AuditEntry` with the
  prompt + output hash (never the bodies), model id, latency, redactions.
- **Hard refusal of regulated activity.** `lib/ai/guardrails.ts:shouldRefuse`
  blocks requests for personal investment advice / insider info before
  they reach the model.
- **Append-only audit log.** No Prisma model exposes update/delete on
  `AuditEntry`. Required for PDPL Art. 23 + ADGM/DIFC procurement.
- **Strict CSP with nonce.** No `unsafe-inline` for scripts; Trusted Types
  required. CSP, HSTS, X-Frame-Options DENY, Permissions-Policy locked,
  COOP/CORP set in `lib/security/headers.ts` and applied by middleware.
- **Token-bucket rate limit** per IP+route in `lib/security/rateLimit.ts`,
  applied in middleware. Policies: `AUTH_SIGNIN` (5/min — anti brute-force),
  `WORKSPACE_API` (120/min), `CONNECTIONS_WRITE` (10/min), `AI_DEEPDIVE`
  (20/min — for the expensive Opus calls).

### Adding a new provider / channel

1. Implement the matching interface (`ConnectionProvider` /
   `NotificationChannel`) in the relevant `providers/` or `channels/`
   directory. Each file documents its required env vars at the top.
2. Register in the corresponding `registry.ts` / `channels/index.ts`.
3. For OAuth providers: the start + callback handlers are generic — no
   route changes needed. For API-key providers: add a paste form in the
   Connections page. For channels: the orchestrator wires in automatically.

### Pilot vs GA gaps

The pilot intentionally does NOT include:
UAE PASS, WorkOS, Sumsub KYB, Nango/Paragon CRM sync, Power BI REST push,
real-time agent loop (Inngest + Redpanda), WebSocket in-app push, per-item
channel routing UI, hosted MCP gateway, SOC 2 evidence collection. All
have interface stubs they'll plug into. See INSTALL.md §10.

## Recent Changes (Apr 2026)
- Reports page: bumped from 4 → 12 entries, all with verified PDF URLs from the Ministry's open-data API. Added URL-driven pagination. Removed the unreliable Google Docs Viewer (`docs.google.com/gview`) wrapper — it was redirecting users to the upstream marketing site whenever the PDF couldn't render.
- Logo: switched `Logo.tsx` from two hand-edited SVGs to one official asset with a CSS filter for the dark variant.
- Favicons: high-res eagle-only `icon.svg` cropped from the official dual-logo + Ministry's own `favicon.ico` as a fallback.
- PlatformShell: split refresh behavior — dossier vs other platform pages.
- Dossier page: 404 → friendly in-platform empty state.
- Signals page: fixed `limit=400` → `limit=200` to satisfy the backend's `Query(le=200)` cap.
- Backend env-loading hardened: `load_dotenv(override=False)`; production env on Vercel is now the canonical source.
- SourceMarquee: replaced text-with-diamond-bullet rows with real publisher favicons (16 PNG/JPEG assets in `public/sources/`) on uniform white tiles, plus the source domain in tiny text.
- PartnersStrip (new): home-page strip of the 20 advisory firms listed in the Ministry's `/api/v1/data/en/partners` endpoint, with logos mirrored locally to `public/partners/`. Inserted into `app/(marketing)/page.tsx` between `PlatformPreview` and `PrincipalsBlock`.
- **v2 foundation shipped (dormant).** Prisma schema, Auth.js v5, AES-256-GCM token vault, audited Anthropic client, append-only audit log, CSP + Trusted Types middleware, token-bucket rate limiter, connection registry (Drive, Notion, Slack, MCP-stub, ADX), notification orchestrator (in-app + email + slack + WhatsApp channels), workspace UI under `/workspace`. Activation steps in [INSTALL.md](./INSTALL.md).
- **Workspace v2 LIVE.** Provisioned Neon Postgres (Frankfurt), pushed `AUTH_SECRET` + `AUTH_URL` + `APP_ORIGIN` + `TOKEN_VAULT_MASTER_KEY` to Vercel, applied initial migration via Vercel build (`scripts/migrate-or-skip.mjs` runs `prisma migrate deploy` before `next build`). Switched auth from magic-link to **email + password** (`Credentials` provider, JWT session, bcrypt hash on `User.passwordHash`). `/auth/signup` creates Tenant + User + signs in; `/auth/signin` validates + signs in; `/workspace` works. Build script auto-runs new migrations on every deploy.
- **Workspace mobile layout fixes.** `WorkspacePulse` used to position `HeroStats` (top-left, `max-w-sm`) and `LiveFeed` (top-right, `w-[88vw]`) as overlapping absolute panels — on phones (< `md`) the LiveFeed covered the HeroStats entirely. Now `HeroStats` spans full width on mobile (`left-4 right-4`, no max-w), and `LiveFeed` drops below it with `top-[236px]` + `max-h-[42vh]` on mobile (preserves the desert-satellite canvas behind it). Desktop positions are unchanged. Workspace sub-nav `Sign out` button was wrapping to two lines inside `overflow-x-auto` because nav links had `whitespace-nowrap` but the button did not — added `whitespace-nowrap` + `shrink-0` on the wrapping form.
- **Why-invest "Next" card rewrite.** The section used the `Card` primitive, whose `.surface-card { background: white }` in `globals.css` has higher specificity than Tailwind's `bg-navy-800`, so the navy bg never rendered and `text-white` headlines disappeared on white-on-white — leaving the section looking like an empty box with just the CTA. Replaced `Card` with a plain div (`bg-navy-900`, radial-gradient accents) and enriched the content with a supporting paragraph, secondary "How the pipeline works" link, and three MiniStat tiles (18+ sources, 6 signal types, 24/7). Used `!text-white` on `SerifHeading` to defeat the `text-navy-800` baked into the primitive.
- **Em-dash removal (house style: no em dashes in visible text).** Replaced `—` with `:`, `·`, `()`, or sentence breaks across user-facing strings only (code comments left intact): reports page titles/subs, WorkspacePulse eyebrow + error text, SourceMarquee aria-labels, watchlist input placeholder, dossier EmptyState subtitle, summarise-watchlist fallback body, ADX + MCP connection display names, Google Drive + Nango description strings. Verified `document.body.innerText.includes('—') === false` on `/why-invest`.
- **Pulse map no longer hijacks the user's viewport.** `PulseMap` used to call `map.fitBounds(points)` inside the `[points]` effect — every SWR refresh (`refreshInterval: 30_000` + `revalidateOnFocus: true`) yanked the viewport back to the "fit all points" extent a few seconds after the user zoomed in. First attempt used `didFitRef` + `userInteractedRef` guards, but that still let the first programmatic fit run and race with user input. Final fix: **removed `map.fitBounds(...)` entirely**. Initial view is now a Dubai close-up (`[25.2048, 55.2708]`, zoom 9 — Dubai + Abu Dhabi + Sharjah tightly framed); the `[points]` effect only paints markers and never touches the viewport. Markers far from the UAE remain reachable via user pan/zoom or through the LiveFeed side panel which lists every signal regardless of map extent.
- **Nango dropped, paste-API-key catalogue + Ministry-grade analytics dashboard (Apr 2026).** Replaced the Nango OAuth layer entirely with a native `lib/connections/catalogue.ts` listing 15 connectors (Power BI Streaming, Tableau, Google Sheets via Apps Script, Slack webhook, Teams webhook, Resend email, WhatsApp, Custom Webhook, Power Automate, Zapier, Make, Airtable, Notion API, MCP endpoint) with per-field specs (url/token/text/textarea, `secret: true` flag for encrypted fields). New `/api/workspace/connectors/save` splits fields into public `Connection.config` and per-field `ConnectionSecret` rows keyed by `kind=field_name` — each secret sealed via `sealSecret(tenantId)` (AES-256-GCM + per-tenant DEK). `/api/workspace/connectors/[id]` DELETE hard-deletes the ciphertext. Connections page rewritten to `ConnectionsView.tsx` with categorised tiles (Analytics / Comms / Automation / Data sources) + a paste modal that renders the provider's setup steps inline and shows an AES-256-GCM security pill. Power BI / Tableau / WhatsApp tiles show `Coming soon` until the dispatch cron ships. New `/workspace/dashboard` renders a full-page analytics view: 8 KPI tiles (live signals, matched, companies, avg score, high-strength %, countries, publishers, watchlist), 30-day area trend (total vs matched), signal-type donut, top-10 companies leaderboard with score bars, sector intensity bar chart (RTL-aware), strength radial, top-8 publishers ranked bar, geographic coverage ranked bar. All data from a new `/api/workspace/dashboard` server route that pulls `/api/companies?limit=500` + the tenant's watchlist and computes aggregates server-side (no external BI vendor). Workspace nav gained a Dashboard link. Added `workspace.nav.dashboard`, `workspace.dashboard.*`, `workspace.connectors.*` to both EN and AR dictionaries.
- **Pulse map dot density now reflects signal volume.** The API route (`/api/workspace/pulse`) emits one point per company HQ + one per expansion target, so a pipeline with 74 signals across ~5 geocoded companies was rendering as ~5 dots — visually implying the workspace was empty. Route now attaches `signalCount: c.signals.length` to each HQ point, and `PulseMap` scatters `min(signalCount - 1, 24)` tiny sibling dots in a deterministic FNV-1a-hashed ring (2.5–10 km, keyed off `${pointId}|${i}` so the scatter is stable across refreshes). Siblings inherit the HQ's colour, matched state, and tooltip context; the main HQ dot's tooltip gains a `· N signals` suffix. No new deps — done with plain `L.circleMarker`, no `leaflet.heat`.
- **Ministry-branded pillar icons on /why-invest.** Replaced the six lucide-react glyphs (`Building2`, `Banknote`, `Cpu`, `Globe2`, `Users2`, `Plane`) with the Ministry of Investment's own "Investment Opportunities" SVGs mirrored verbatim from `https://www.investuae.gov.ae/storage/post/<hash>.svg` into `/public/icons/ministry/*.svg` (liveability, capital, innovation, knowledge, talent, sustainability). Single-colour gold (`#92722A`) fills that already match the brand palette, no CSS tinting needed. Rendered via `next/image` inside a `rounded-md bg-gold-50 ring-1 ring-gold-100` tile so they read as proper pillar markers. Pillar copy kept as-is except `Global Reach` gained a sustainability angle to align visually with its new icon.
- **Ministry icons rolled out across the UI, every slot unique.** 15 SVGs mirrored from the Ministry's `website-api.investuae.gov.ae/api/v1/data/en/home` endpoint (`investmentOpportunities` + `platformGrowth` + `keyFacts`) into `/public/icons/ministry/`, plus 8 Heroicons-solid SVGs (`radar`, `antenna`, `brain`, `target`, `send`, `buildings`, `globe-pin`, `chart-line`) retinted to the same gold `#92722A` so the set blends. Final mapping across 23 icon slots uses each SVG exactly once: why-invest pillars (liveability / capital / innovation / knowledge / talent / sustainability), `HowItWorks` (antenna / brain / fact-rank / send), `PrincipalsBlock` (quality / business-friendly / target / fact-greenfield), `PlatformPreview` on dark navy with `bg-gold-400/10` circle frames (radar / gateway / location / sectors), `PlatformShell` sub-nav tabs at 16 px (fact-fdi / connectivity / buildings / globe-pin / chart-line). `RefreshCw`, arrows, chevrons and other UI affordances remain lucide since they aren't pillar marks.
- **Ministry icon fill normalization.** The 3 `keyFacts` SVGs from the Ministry's API (`fact-fdi`, `fact-rank`, `fact-greenfield`) ship with fill `#343330` (near-black) instead of the gold `#92722A` used by their `investmentOpportunities` + `platformGrowth` icons — on dark-bg hover states (HowItWorks tiles turn navy-800 on hover) the dark-filled icons visually disappeared, reported by the user as "icons go black on hover". Fixed by running a one-shot normalisation over every file in `/public/icons/ministry/` that rewrites any non-gold, non-`none` fill/stroke attribute to `#92722A`. All icons now render in the same brand gold regardless of background state.
- **Hero badge icon.** The `SCANNING N+ LIVE SOURCES` eyebrow in `HeroCarousel` used the lucide `Sparkles` glyph. Swapped for a new `scan.svg` (Heroicons `magnifying-glass-circle` retinted to `#92722A`) rendered via `next/image` at 14 px. 24 unique Ministry/Ministry-styled icons total across the site now, each slot distinct.
- **Hero now uses the Ministry's own media.** Dropped the generic Unsplash skyline background and the hand-drawn `SkylineLines` SVG tower silhouettes. Each slide carries its own `background` (video or image), mirrored verbatim from the Ministry's home-page hero banner (`https://www.investuae.gov.ae/en`) into `/public/hero/` — `ministry-video.mp4` (10.7 MB, with `ministry-video-poster.jpg`) on slide 1, `fdi-report.jpg` on slide 2, `ministry-statement.jpg` on slide 3. Backgrounds cross-fade via `AnimatePresence mode="sync"` on 1.1 s easeInOut. Overlay tuned to a horizontal gradient (`from-navy-900/90 via-navy-900/75 to-navy-900/45`) so the left side stays navy enough for the white serif headline while the Ministry imagery still reads through on the right; bottom 40 px fade keeps the carousel controls legible. Kept the floating gold data orbs and a low-opacity blueprint grid as subtle platform-data texture.
- **RSS lead images on signal cards.** The backend RSS aggregator (`backend/app/services/rss_aggregator.py`) never extracted article images — `SourceArticle` only carried title/url/summary/published_at, so downstream signal cards were text-only. Added `image_url: Optional[str]` to `SourceArticle` (both the Pydantic schema and the mirrored TS `lib/types.ts`), and `_extract_image_url()` that checks media:content → media:thumbnail → `<enclosure type="image/*">` → first `<img>` in summary HTML. Wired through workspace pulse (`PulseSignal.sourceImageUrl`) and both signal card surfaces.
- **og:image enrichment pass + Vercel maxDuration bump.** Most direct-publisher RSS feeds don't embed images in the feed body, so `fetch_all_articles` now runs a second bounded-concurrency pass (`_enrich_with_og_images`) that fetches each imageless article page and scrapes `og:image` / `twitter:image` / `<link rel="image_src">` from the first 120 KB of HTML — 12 parallel workers, 6 s per-request timeout, 25 s global budget. Raised `backend/vercel.json` `maxDuration` from the implicit Hobby 10 s to 60 s so the enrichment pass can actually complete inside the serverless function.
- **Known limit: Google News RSS entries have no images.** Their RSS feed provides only a redirect link to `news.google.com/rss/articles/CBMi…`, which returns HTTP 400 when accessed server-side (Google changed their article-ID resolution in 2024). Confirmed via live fetch — base64-decoded payloads no longer contain the source URL. Result: for Google-News-sourced signals we can never get an article image. Fix was to render a branded gradient banner per signal type (`TYPE_GRADIENT` in platform `SignalCard`, `TYPE_GRADIENT_DARK` in workspace `LiveFeed`) with the signal type name in serif as visual anchor — funding gets emerald, partnership gets purple, launch gets gold, etc., all fading to navy-900. Every signal card now has image-like visual weight even without a real upstream image, so the feed reads like a media wall instead of a text dump. Existing `cache/pipeline_snapshot.json` will backfill image URLs on the next `/api/refresh`.
- **Signal dedup + entity filter.** The platform `/platform/signals` page used to render card-per-company-per-signal, which meant the same article appeared 2–3 times whenever the entity extractor surfaced multiple "companies" from one body — typically noisy sentence fragments like "THE ROUND WAS LED BY EXISTING NEW", "SAFAR PARTNERS THE", "UAE port of Jebel Ali", etc. Two-layer fix. **Frontend** (`app/(platform)/platform/signals/page.tsx`): collapse signals by `source.url` after flattening; when multiple occurrences exist, keep the one whose company name scores best via a `scoreCompanyName()` heuristic (penalises fragment markers like "series B", "led by", trailing articles, all-caps). **Backend** (`app/agents/entity_agent.py` + `app/agents/orchestrator.py`): added `EntityAgent._looks_like_company_name()` classmethod with rules for word count (≤ 6), leading/trailing stopwords, ≥ 2 glue words ("of/and/with/…"), fragment verbs ("leads/boosts/formalise/…"), 4-digit years, "4.8m"-style stat tokens, lowercase/all-caps patterns, and single-token ≤ 2-char names. Orchestrator now also calls it before adding to the company map, and `_find_canonical` was rewritten to preserve the *original* display casing (stores `registry[normalized] = original_display`), so the UI no longer shows `"dubai"` when the article wrote `"Dubai Future Foundation"`.
- **Dropped Google News feeds, widened pipeline funnel, added lazy og:image endpoint.** The 14 `google_news_targeted` feeds (Dubai Investment, UAE Fintech, MENA M&A, etc.) and 4 `sector_specialists` Google News queries were pulled from `backend/data/sources.yaml` because their `news.google.com/rss/articles/CBMi…` article URLs return HTTP 400 server-side (Google's 2024 API change), so we could never fetch `og:image` for those signals. Replaced with direct publisher feeds verified to respond 200 and either embed `media:content` in the feed body or expose `og:image` on the article page: **The National** (economy / property / money categories via `arc/outboundfeeds/rss/category/...`), **AGBI** (Arab Gulf Business Insight), **MAGNiTT** (MENA VC data), **Gulf Today Business**, **Dubai Chronicle**, **Dubai Week**, **TRENDS MENA**, **Skift** (travel/hospitality), **TechWire Asia**. Bumped `max_companies` 40 → 120, `max_articles_per_feed` 80 → 120, `parallel_fetches` 12 → 16, and the og:image enrichment cap 80 → 150. Image coverage at the pipeline layer jumped from ~6 % to ~40 %. For the remaining 60 % (direct-feed articles whose enrichment pass ran out of Vercel-function time budget), added a **lazy `/api/og-image?url=` endpoint** with in-process caching and a `useLazyOgImage` hook on the client that fires one background fetch per imageless card. Results fill in progressively after paint without blocking the pipeline, and the gradient fallback still shows instantly for URLs where no og:image exists (paywalled articles, feed redirects).
- **Signal volume widened to ≥ 100 cards per refresh.** Pipeline was capping at ~25 unique-URL cards after frontend dedup because every filter stage (relevance, classifier confidence, embedding dedup) was over-aggressive. Final cut: **skip the embedding-relevance filter entirely for MENA/GCC/UAE-region articles** — the reason those publishers are in `sources.yaml` is that their coverage is already investment-relevant. Non-MENA articles still clear the `relevance_threshold: 0.12` embedding bar, with a keyword-classifier fallback at `0.08`. Removed the classifier `confidence < 0.02` drop entirely (scorer ranks weak signals low; dropping kills the feed). Embedding dedup tightened to `threshold=0.98` (only wire-copy near-duplicates collapse). Article cap `600 → 1000`, `max_companies 120 → 150`.
- **Refresh now additive, not replacement.** Every `/api/refresh` POST used to *overwrite* the pipeline snapshot, so users who mashed Refresh got the same ~125 companies each time (publishers don't post new articles every 10 s). Now `run_pipeline()` calls `_merge_snapshots(previous, new)` before `cache.set` — unions companies by `id`, merges their `signals` lists by id, keeps each company's freshest 15 signals, drops signals older than 30 days, caps the pool at 200 companies sorted by composite score. Aliases accumulate across runs, `first_seen` takes the earliest, `last_seen` the latest. Live verify: refresh #1 grew the pool from 125 → **188 companies / 238 signals / 184 unique URLs** as fresh articles from Wamda / Khaleej Times / The National / Crunchbase landed in the merged snapshot.
- **Full EN/AR i18n with RTL layout.** Added a custom React-context i18n instead of retrofitting `next-intl` (which would have required `[locale]` route prefixes across 25 pages). Files: `lib/i18n/dictionary.ts` (flat dot-notation EN + AR, ~380 keys), `lib/i18n/LocaleProvider.tsx` (context, `localStorage` persistence, auto-detects `navigator.language.startsWith("ar")`, syncs `lang` + `dir` on `<html>`). Root `app/layout.tsx` loads Noto Naskh Arabic (body) + Noto Serif Display (headlines) via `next/font/google`, wrapped by `LocaleProvider`. `globals.css` swaps the sans/serif stacks to the Arabic fonts whenever `html[dir="rtl"]`. Every visible string across Header / Footer / HeroCarousel / HowItWorks / PrincipalsBlock / PlatformPreview / StatsBar / CtaBand / OpportunityShowcase / PartnersStrip / WhyInvest / Reports / About / PlatformShell / every platform page (overview / signals / companies / geo / sectors) / SignalCard / CompanyCard / auth sign-in + sign-up renders through `t("namespace.key")`. Directional icons (`ArrowRight`, `ChevronLeft/Right`, `ArrowUpRight`) carry `rtl:-scale-x-100` so they mirror under `dir="rtl"`. Auth pages were split into `page.tsx` server wrapper + `*Form.tsx` client component + `actions.ts` server action so the form can call `useLocale()` without losing the bcrypt/tenant logic. **Arabic RSS feeds added** to `backend/data/sources.yaml` under a new `arabic_language` block (Al Khaleej, BBC Arabic Business, Al Watan Saudi, Youm7 Egypt, Aawsat pan-Arab, Sputnik Arabic) so the signal feed surfaces native Arabic article titles/summaries alongside English ones. Proper names (report titles, company names, source_name) kept in source language by design.
- **og:image scraper now rotates user agents.** Some publishers (Finextra, WSJ, a few Bloomberg properties) return 403 to generic Chrome UAs but whitelist `facebookexternalhit/1.1` and `Mozilla/5.0 (Twitterbot/1.0)` for rich-embed unfurling. `_scrape_og_image` (used by both the pipeline enrichment pass and the `/api/og-image` on-demand endpoint) now tries the Facebook UA first, then Twitterbot, then the Chrome UA, stopping at the first 2xx. Sites that genuinely have no `og:image` / `twitter:image` / `<link rel="image_src">` in their HTML (some minor regional publishers) still get the branded gradient fallback — by design, not a bug.

@AGENTS.md

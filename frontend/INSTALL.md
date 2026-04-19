# Investor Workspace v2 — Activation Guide

The v2 foundation is **deployed and dormant**. The app builds, the marketing
site is unchanged, and `/workspace` redirects to sign-in. Sign-in itself
will fail until the steps below are done because every backing service
needs credentials.

This is intentional: it lets you provision UAE-region resources and add
secrets at your own pace without breaking anything live.

---

## 1. Provision Postgres (~5 minutes)

In the Vercel dashboard:

1. Project → **Storage** → Create → **Postgres** → name `investuae-pilot`.
2. Region: pick **Frankfurt (fra1)** for the pilot — closest Vercel-managed
   region to UAE. _For v2 GA we move to Azure UAE North; this DB is throwaway._
3. Vercel will auto-add these env vars to the Production environment:
   - `POSTGRES_PRISMA_URL`
   - `POSTGRES_URL_NON_POOLING`
   - `POSTGRES_URL`
   - `POSTGRES_USER`, `POSTGRES_HOST`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE`

That's the only env vars you need from the storage step.

## 2. Run the migration

From `frontend/`:

```bash
# Pull production env locally so prisma can reach the new DB
vercel env pull .env.production.local --environment=production --yes

# Apply the schema
DATABASE_URL=$(grep POSTGRES_URL_NON_POOLING .env.production.local | cut -d= -f2- | tr -d '"') \
  npx prisma migrate deploy

# Or, first time only, generate the migration file:
DATABASE_URL=$(grep POSTGRES_URL_NON_POOLING .env.production.local | cut -d= -f2- | tr -d '"') \
  npx prisma migrate dev --name init
```

After this, `/workspace` should render the empty-state dashboard for any
signed-in user.

## 3. Auth.js secret + Resend (magic-link login)

Generate a 32-byte secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Sign up at <https://resend.com>, verify a sender domain (or use their
`onboarding@resend.dev` for testing only), grab the API key.

Add these to Vercel Production env:

| Var | Example |
|----|---------|
| `AUTH_SECRET` | the 32-byte base64 string above |
| `AUTH_URL` | `https://frontend-iota-seven-30.vercel.app` |
| `APP_ORIGIN` | same as `AUTH_URL` (used by OAuth callbacks) |
| `RESEND_API_KEY` | `re_xxxxxxxx...` |
| `FROM_EMAIL` | `noreply@yourdomain.ae` (must match a Resend-verified domain) |

After adding, re-deploy: `vercel --prod --yes`.

Sign-in flow then works end-to-end: paste email → receive magic link →
arrive at `/workspace` with a fresh tenant + owner role.

## 4. Token vault master key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Add to Vercel:

| Var | Example |
|----|---------|
| `TOKEN_VAULT_MASTER_KEY` | base64 of 32 random bytes |

This key derives a per-tenant DEK via HKDF. **Rotation procedure:** generate
a new key, re-encrypt all `ConnectionSecret` rows in a one-shot script
(TODO: add `scripts/rotate-vault.ts`), then swap the env var. Old key MUST
be retained until the re-encrypt finishes.

## 5. Connection providers (optional, do as you wire each)

### Google Drive

1. <https://console.cloud.google.com> → new project → **APIs & Services** →
   Credentials → OAuth client ID → Web application.
2. Authorized redirect URI: `${APP_ORIGIN}/api/connections/google-drive/callback`
3. Add to Vercel:

   ```
   GOOGLE_OAUTH_CLIENT_ID=...
   GOOGLE_OAUTH_CLIENT_SECRET=...
   ```

### Notion

1. <https://www.notion.so/my-integrations> → New integration (public).
2. Redirect URI: `${APP_ORIGIN}/api/connections/notion/callback`
3. Add to Vercel:

   ```
   NOTION_OAUTH_CLIENT_ID=...
   NOTION_OAUTH_CLIENT_SECRET=...
   ```

### Slack

1. <https://api.slack.com/apps> → Create New App → From scratch.
2. OAuth scopes: `chat:write`, `chat:write.public`, `channels:read`.
3. Redirect URI: `${APP_ORIGIN}/api/connections/slack/callback`
4. Add to Vercel:

   ```
   SLACK_OAUTH_CLIENT_ID=...
   SLACK_OAUTH_CLIENT_SECRET=...
   ```

### ADX (Abu Dhabi Securities Exchange)

API-key based — no OAuth dance. Each tenant pastes their own ADX data API
key in the workspace UI. Nothing to set in env.

### MCP — Workspace Files

Pilot tier disabled. We'll provision per-tenant Tigris namespaces in v2.1.

## 6. Notification channels (optional)

### WhatsApp (Meta Cloud API)

1. <https://developers.facebook.com> → Business app → WhatsApp product.
2. Add a phone number, get permanent access token, register the
   `signal_alert_v1` template (4 body params) and submit for approval.
3. Add to Vercel:

   ```
   WHATSAPP_PHONE_NUMBER_ID=...
   WHATSAPP_ACCESS_TOKEN=...
   WHATSAPP_TEMPLATE_NAMESPACE=... (optional)
   WHATSAPP_FALLBACK_TO=+9715... (pilot only — single test recipient)
   ```

Until Meta approves the template, the channel returns
`error: meta-400: template-not-approved`. That's not a bug.

### Other channels (Outlook, Gmail, SMS)

Provider stubs exist; activate by implementing `lib/notifications/channels/<id>.ts`
matching the `NotificationChannel` interface and registering in `index.ts`.
The orchestrator wires in automatically.

## 7. AI runtime

Already configured. Reuses `ANTHROPIC_API_KEY` from the existing backend
deployment. Every LLM call now goes through `lib/ai/client.ts` which:

- Refuses regulated activity (investment advice, insider info, etc.).
- Guards input against prompt injection + secret leakage.
- Scrubs output (secrets always; PII when channel demands).
- Audits every decision (model, tier, latency, input/output hash, cost) to
  the `AuditEntry` table.

## 8. Verifying the install

Once the DB + AUTH_SECRET + RESEND_API_KEY + FROM_EMAIL + TOKEN_VAULT_MASTER_KEY
are set:

```bash
# Smoke
curl -I https://frontend-iota-seven-30.vercel.app/workspace
# → 307 redirect to /auth/signin (because no session cookie)

curl -I https://frontend-iota-seven-30.vercel.app/auth/signin
# → 200, signed CSP + HSTS headers
```

Then in the browser:

1. <https://frontend-iota-seven-30.vercel.app/auth/signin>
2. Paste your email → click link in inbox → land on `/workspace`.
3. **Connections** tab → providers visible, OAuth ones marked "Coming soon"
   until their env vars are set.
4. **Watchlist** tab → add a row → confirm it persists across reloads.

## 9. Compliance posture (pilot)

| Control | Status |
|--------|-------|
| Data residency | Frankfurt for pilot; **must move to UAE region for GA** |
| Encryption at rest | Postgres (Vercel default) + AES-256-GCM token vault |
| Encryption in transit | TLS 1.3 enforced + HSTS preload |
| Authn | Magic-link with database sessions (no JWTs in browser) |
| Authz | Tenant id required on every server query; row-level filter |
| Audit log | Append-only `AuditEntry` table; every action recorded |
| Rate limit | Token bucket per IP per route policy |
| CSP | Strict, nonce-based, Trusted Types required for scripts |
| AI guardrails | Input + output guards, regulated-activity refusal |
| PDPL | DPIA pending; legal review **before any customer onboarding** |

## 10. What's NOT shipped yet

The following are scaffolded with provider stubs but not wired:

- UAE PASS sign-in
- WorkOS / Sumsub for KYB
- Nango / Paragon for CRM sync
- Power BI REST push
- Real-time agent loop (Inngest + Redpanda)
- WebSocket in-app live updates
- Per-watchlist channel routing UI
- MCP gateway for hosted MCP servers
- SOC 2 evidence collection

These will be addressed in v2.1+ as requirements firm up. The interfaces
they need to plug into already exist (`ConnectionProvider`,
`NotificationChannel`, `chat()`, `audit()`).

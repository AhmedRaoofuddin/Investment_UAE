// Connection types — the contract every provider implements.
//
// A "connection" is a tenant-scoped link to a third-party data source. Three
// shapes covered:
//   1. OAUTH_APP   — Drive, Notion, Asana, Salesforce, HubSpot, Outlook,
//                    Gmail, Slack. Auth.js v5 handles the consent flow; we
//                    persist the resulting tokens in ConnectionSecret.
//   2. API_KEY     — Twilio, Knock, ADX/DFM data feeds where you paste a key.
//   3. MCP_SERVER  — Server-side MCP gateway. The MCP server runs in our
//                    infra (or is upstream-managed) and the user authorises
//                    a per-tenant scope on it.
//
// Every provider exports an object that satisfies ConnectionProvider. A
// central registry (`registry.ts`) discovers them; the workspace UI reads
// `listProviders()` to render the catalogue.

import type { ConnectionKind, ConnectionStatus } from "@prisma/client";

export interface ProviderCatalogueEntry {
  id: string; // "google-drive" | "notion" | "mcp:filesystem"
  kind: ConnectionKind;
  name: string;
  description: string;
  // Used in the UI tile.
  iconKey: string; // "drive" | "notion" | "asana" | "slack" | ...
  // Tier(s) that can use this provider.
  tiers: ("PILOT" | "VERIFIED" | "INSTITUTION")[];
  // Surfaced as the provider's homepage on the workspace tile.
  docsUrl: string;
  // Becomes false once we ship the OAuth flow / MCP wiring; until then
  // the UI shows a "Coming soon" badge instead of the connect button.
  ready: boolean;
}

// Result of an OAuth callback after the user consents. Implementations
// return this from `completeOAuth` and the registry persists the tokens
// via the encrypted vault.
export interface OAuthGrant {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  // Public config (account ids, granted scopes) — stored on Connection.config.
  config: Record<string, unknown>;
}

export interface ConnectionProvider {
  meta: ProviderCatalogueEntry;
  // OAuth providers implement these:
  authorizeUrl?: (state: string) => string;
  completeOAuth?: (code: string, state: string) => Promise<OAuthGrant>;
  // API-key providers implement this:
  validateApiKey?: (key: string) => Promise<{ ok: boolean; error?: string }>;
  // All providers must support a no-op connectivity check for status display.
  ping?: (tenantId: string, connectionId: string) => Promise<ConnectionStatus>;
}

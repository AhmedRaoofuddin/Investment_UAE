// Nango integration.
//
// Architecture:
//   - Nango holds the OAuth-app credentials for every provider (Google
//     Drive, Notion, Slack, HubSpot, Salesforce, ...). We don't register
//     OAuth apps ourselves.
//   - Each user's connection is a Nango "connection" identified by a
//     `connectionId` we mint (we use the tenant id, optionally suffixed
//     by integration when a tenant connects multiple).
//   - Browser-side Connect UI is opened with a short-lived "session
//     token" we mint on the server via Nango's REST API. The user clicks
//     through Nango's hosted consent flow and lands back in our app.
//   - When we need a third-party token, we call Nango's GET /connection
//     endpoint with the integration + connectionId. Nango handles refresh
//     transparently. We never see the user's refresh token.
//
// The connectionId format: `tenant_<tenantId>_<integrationId>`. Stable
// per (tenant, integration) so reconnecting is idempotent.
//
// All calls are server-side. The browser only sees the short-lived
// session token, never the secret key.

const NANGO_BASE = "https://api.nango.dev";

function secretKey(): string {
  const k = process.env.NANGO_SECRET_KEY;
  if (!k) {
    throw new Error(
      "NANGO_SECRET_KEY not set. Sign up at app.nango.dev, copy your env's Secret Key, " +
        "and add to Vercel env.",
    );
  }
  return k;
}

export function isNangoConfigured(): boolean {
  return Boolean(process.env.NANGO_SECRET_KEY);
}

export function buildConnectionId(tenantId: string, integrationId: string): string {
  return `tenant_${tenantId}_${integrationId}`;
}

interface NangoSessionTokenResponse {
  data: { token: string; expires_at: string };
}

/**
 * Mint a short-lived session token the browser uses to open the Nango
 * Connect UI. Token is bound to (end_user.id, allowed integrations).
 *
 * Called from a server route on the workspace's behalf.
 */
export async function createConnectSession(args: {
  tenantId: string;
  email: string;
  displayName?: string;
  // Empty array = all enabled integrations. Otherwise the Connect UI
  // restricts the user to picking from these.
  allowedIntegrations?: string[];
}): Promise<{ token: string; expiresAt: string }> {
  const body = {
    end_user: {
      id: args.tenantId,
      email: args.email,
      display_name: args.displayName ?? args.email,
    },
    organization: {
      id: args.tenantId,
      display_name: args.displayName ?? args.tenantId,
    },
    allowed_integrations: args.allowedIntegrations,
  };

  const resp = await fetch(`${NANGO_BASE}/connect/sessions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secretKey()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(`Nango session create failed (${resp.status}): ${detail}`);
  }
  const json = (await resp.json()) as NangoSessionTokenResponse;
  return { token: json.data.token, expiresAt: json.data.expires_at };
}

export interface NangoConnection {
  id: number;
  connection_id: string;
  provider_config_key: string; // integration id
  provider: string;
  created: string;
  metadata?: Record<string, unknown> | null;
  errors?: { type: string; message: string }[];
}

/**
 * List the tenant's Nango connections. We pass `endUserId=tenantId` so
 * Nango filters server-side.
 */
export async function listNangoConnections(tenantId: string): Promise<NangoConnection[]> {
  const url = new URL(`${NANGO_BASE}/connection`);
  url.searchParams.set("endUserId", tenantId);
  const resp = await fetch(url, {
    headers: { authorization: `Bearer ${secretKey()}` },
    cache: "no-store",
  });
  if (!resp.ok) {
    if (resp.status === 404) return [];
    throw new Error(`Nango list failed (${resp.status})`);
  }
  const json = (await resp.json()) as { connections: NangoConnection[] };
  return json.connections ?? [];
}

/**
 * Disconnect a single Nango connection. Removes the stored token on
 * Nango's side so the user must re-consent to reconnect.
 */
export async function deleteNangoConnection(args: {
  integrationId: string;
  connectionId: string;
}): Promise<void> {
  const url = new URL(
    `${NANGO_BASE}/connection/${encodeURIComponent(args.connectionId)}`,
  );
  url.searchParams.set("provider_config_key", args.integrationId);
  const resp = await fetch(url, {
    method: "DELETE",
    headers: { authorization: `Bearer ${secretKey()}` },
  });
  if (!resp.ok && resp.status !== 404) {
    const detail = await resp.text();
    throw new Error(`Nango delete failed (${resp.status}): ${detail}`);
  }
}

// Catalogue. Each entry is a Nango integration id you must enable in your
// Nango dashboard (Integrations tab). The ones below are the recommended
// pilot set. Add or remove freely.
export interface NangoCatalogueEntry {
  integrationId: string; // Nango integration key (matches dashboard)
  name: string;
  description: string;
}

export const NANGO_CATALOGUE: NangoCatalogueEntry[] = [
  {
    integrationId: "google-drive",
    name: "Google Drive",
    description: "Read-only access to investor documents: term sheets, decks, due-diligence PDFs.",
  },
  {
    integrationId: "notion",
    name: "Notion",
    description: "Pull pages and databases from your Notion workspace into the agent context.",
  },
  {
    integrationId: "slack",
    name: "Slack",
    description: "Post watchlist alerts in Slack channels you choose.",
  },
  {
    integrationId: "hubspot",
    name: "HubSpot",
    description: "Surface deals + contacts that touch your watchlist companies.",
  },
  {
    integrationId: "salesforce",
    name: "Salesforce",
    description: "Cross-reference signals against your active opportunity pipeline.",
  },
  {
    integrationId: "microsoft-outlook",
    name: "Outlook",
    description: "Receive briefings + alerts in your Outlook inbox.",
  },
];

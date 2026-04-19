// Workspace overview — landing page after sign-in.
//
// Server component: runs auth + the read queries needed to hydrate the
// OverviewView. We pull more than just counts — the page surfaces recent
// matched alerts, the active connector list, and the user's watchlist so
// it reads like a real at-a-glance dashboard instead of four flat tiles.
//
// Every DB read is wrapped in a try/catch that falls back to an empty
// array / zero count and logs the error. Production goal: a single flaky
// query never 500s the whole landing page — the tiles and sections
// degrade independently.

import { db, isDbConfigured } from "@/lib/db";
import { requireSession } from "@/lib/security/session";
import { OverviewView } from "./OverviewView";

async function safe<T>(promise: Promise<T>, fallback: T, tag: string): Promise<T> {
  try {
    return await promise;
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    console.error(`[workspace/overview] ${tag} failed: ${msg}`);
    return fallback;
  }
}

export default async function WorkspaceOverview() {
  const session = await requireSession();

  let connections = 0;
  let watchlist = 0;
  let unread = 0;
  let aiCalls = 0;
  let recentAlerts: {
    id: string;
    title: string;
    body: string;
    severity: string;
    status: string;
    createdAt: string;
  }[] = [];
  let watchlistItems: { id: string; kind: string; value: string; label: string }[] = [];
  let activeConnectors: { id: string; provider: string; label: string | null }[] = [];

  if (isDbConfigured) {
    // Each query is independent — one failure shouldn't kill the page.
    const [c, w, n, a, alerts, wl, conns] = await Promise.all([
      safe(
        db().connection.count({
          where: { tenantId: session.tenantId, status: "ACTIVE" },
        }),
        0,
        "connection.count",
      ),
      safe(
        db().watchlistItem.count({ where: { tenantId: session.tenantId } }),
        0,
        "watchlistItem.count",
      ),
      safe(
        db().notification.count({
          where: { tenantId: session.tenantId, status: "UNREAD" },
        }),
        0,
        "notification.count",
      ),
      safe(
        db().auditEntry.count({
          where: { tenantId: session.tenantId, action: "ai.decision" },
        }),
        0,
        "auditEntry.count",
      ),
      safe(
        db().notification.findMany({
          where: {
            tenantId: session.tenantId,
            status: { in: ["UNREAD" as const, "READ" as const] },
          },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            title: true,
            body: true,
            severity: true,
            status: true,
            createdAt: true,
          },
        }),
        [] as Array<{
          id: string;
          title: string;
          body: string;
          severity: "INFO" | "ALERT" | "CRITICAL";
          status: "UNREAD" | "READ" | "ARCHIVED";
          createdAt: Date;
        }>,
        "notification.findMany",
      ),
      safe(
        db().watchlistItem.findMany({
          where: { tenantId: session.tenantId },
          orderBy: { createdAt: "desc" },
          take: 8,
        }),
        [] as Array<{ id: string; kind: string; value: string; label: string }>,
        "watchlistItem.findMany",
      ),
      safe(
        db().connection.findMany({
          where: { tenantId: session.tenantId, status: "ACTIVE" },
          orderBy: { updatedAt: "desc" },
          take: 8,
          select: { id: true, provider: true, label: true },
        }),
        [] as Array<{ id: string; provider: string; label: string | null }>,
        "connection.findMany",
      ),
    ]);
    connections = c;
    watchlist = w;
    unread = n;
    aiCalls = a;
    recentAlerts = alerts.map((x) => ({
      id: x.id,
      title: x.title,
      body: x.body,
      severity: String(x.severity),
      status: String(x.status),
      createdAt:
        x.createdAt instanceof Date ? x.createdAt.toISOString() : String(x.createdAt),
    }));
    watchlistItems = wl.map((x) => ({
      id: x.id,
      kind: String(x.kind),
      value: x.value,
      label: x.label,
    }));
    activeConnectors = conns;
  }

  // Defensive: always pass a string, never undefined.
  const username = (session.email ?? "").split("@")[0] || "user";

  return (
    <OverviewView
      username={username}
      counts={{ connections, watchlist, unread, aiCalls }}
      recentAlerts={recentAlerts}
      watchlistItems={watchlistItems}
      activeConnectors={activeConnectors}
      dbConfigured={isDbConfigured}
    />
  );
}

// Connections catalogue.
//
// Server component fetches the list of active/revoked connections for the
// tenant, pairs them with the curated CONNECTORS catalogue, then hands
// the combined dataset to `ConnectionsView` (client) for rendering + the
// paste modal.

import { db, isDbConfigured } from "@/lib/db";
import { requireSession } from "@/lib/security/session";
import { CONNECTORS } from "@/lib/connections/catalogue";
import { ConnectionsView } from "./ConnectionsView";

export default async function ConnectionsPage() {
  const session = await requireSession();

  // Pull any connections the tenant already saved so the UI can mark
  // tiles as "Connected" and offer a Disconnect action. We never return
  // ciphertext — only row metadata.
  const saved = isDbConfigured
    ? await db().connection.findMany({
        where: { tenantId: session.tenantId, status: "ACTIVE" },
        select: {
          id: true,
          provider: true,
          status: true,
          label: true,
          config: true,
          updatedAt: true,
          lastError: true,
        },
      })
    : [];

  return (
    <ConnectionsView
      connectors={CONNECTORS}
      saved={saved.map((s) => ({
        id: s.id,
        provider: s.provider,
        status: s.status,
        label: s.label,
        config: (s.config ?? {}) as Record<string, string>,
        updatedAt: s.updatedAt.toISOString(),
        lastError: s.lastError,
      }))}
    />
  );
}

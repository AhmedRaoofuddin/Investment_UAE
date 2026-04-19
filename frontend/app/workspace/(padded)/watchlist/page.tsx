// Watchlist editor.
//
// Server component pulls the current list from Postgres. Rendering + i18n
// moved to `WatchlistView` (client) so the UI can call useLocale() for
// EN/AR translations.

import { db, isDbConfigured } from "@/lib/db";
import { requireSession } from "@/lib/security/session";
import { WatchlistView } from "./WatchlistView";

export default async function WatchlistPage() {
  const session = await requireSession();
  const items = isDbConfigured
    ? await db().watchlistItem.findMany({
        where: { tenantId: session.tenantId },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <WatchlistView
      items={items.map((i) => ({
        id: i.id,
        kind: i.kind,
        value: i.value,
        label: i.label,
      }))}
    />
  );
}

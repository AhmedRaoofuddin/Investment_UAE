// Notifications inbox.
//
// Server component runs auth + DB queries; rendering + i18n delegated to
// `NotificationsView` (client) so useLocale() can translate all UI.

import { db, isDbConfigured } from "@/lib/db";
import { requireSession } from "@/lib/security/session";
import { NotificationsView } from "./NotificationsView";

interface PageProps {
  searchParams: Promise<{ view?: string; info?: string }>;
}

export default async function NotificationsPage({ searchParams }: PageProps) {
  const session = await requireSession();
  const sp = await searchParams;
  const view = sp.view === "archived" ? "archived" : "inbox";
  const info = sp.info ?? null;

  let items: Array<{
    id: string;
    severity: "INFO" | "ALERT" | "CRITICAL";
    status: "UNREAD" | "READ" | "ARCHIVED";
    title: string;
    body: string;
    createdAt: Date;
  }> = [];
  const counts = { inbox: 0, archived: 0, unread: 0 };
  // When the summarise-watchlist action gets throttled, we redirect
  // here with ?info=throttled. Look up the most recent ai-summary row
  // so the banner can show "next available in N minutes" instead of a
  // vague notice.
  let throttleNextAt: string | null = null;

  if (isDbConfigured) {
    const where =
      view === "archived"
        ? { tenantId: session.tenantId, status: "ARCHIVED" as const }
        : { tenantId: session.tenantId, status: { in: ["UNREAD" as const, "READ" as const] } };
    items = await db().notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        severity: true,
        status: true,
        title: true,
        body: true,
        createdAt: true,
      },
    });
    const grouped = await db().notification.groupBy({
      by: ["status"],
      where: { tenantId: session.tenantId },
      _count: true,
    });
    for (const g of grouped) {
      if (g.status === "ARCHIVED") counts.archived += g._count;
      else counts.inbox += g._count;
      if (g.status === "UNREAD") counts.unread += g._count;
    }

    if (info === "throttled") {
      const last = await db().notification.findFirst({
        where: { tenantId: session.tenantId, sourceKind: "ai-summary" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      if (last) {
        throttleNextAt = new Date(
          last.createdAt.getTime() + 5 * 60 * 1000,
        ).toISOString();
      }
    }
  }

  return (
    <NotificationsView
      items={items}
      counts={counts}
      view={view}
      info={info}
      throttleNextAt={throttleNextAt}
    />
  );
}

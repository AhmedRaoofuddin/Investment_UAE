// Notification orchestrator.
//
// Lifecycle:
//   1. Persist canonical row in `notification` table (always succeeds, or
//      we throw — DB is the source of truth).
//   2. Fan out to requested channels in parallel.
//   3. Per-channel result merged into `Notification.deliveries`.
//   4. Audit + log.
//
// Channels are skipped silently when they're not configured (e.g. no
// WhatsApp creds) — the in-app channel always works so the user still
// sees the alert.

import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { listChannels } from "./channels";
import type { ChannelId, DeliveryResult, NotificationMessage } from "./types";
import type { NotificationSeverity } from "@prisma/client";
import { randomUUID } from "node:crypto";

export interface CreateNotificationInput {
  tenantId: string;
  userId?: string | null;
  severity?: NotificationSeverity;
  title: string;
  body: string;
  link?: string;
  sourceKind?: string;
  sourceId?: string;
  // Default = in-app only. Wire to user preferences once UI ships.
  channels?: ChannelId[];
}

export async function createNotification(input: CreateNotificationInput) {
  const messageId = randomUUID();
  const channels = input.channels ?? ["in-app"];

  const row = await db().notification.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId ?? null,
      severity: input.severity ?? "INFO",
      title: input.title,
      body: input.body,
      sourceKind: input.sourceKind ?? null,
      sourceId: input.sourceId ?? null,
      deliveries: [],
    },
  });

  const msg: NotificationMessage = {
    messageId,
    tenantId: input.tenantId,
    userId: input.userId ?? null,
    severity: row.severity,
    title: input.title,
    body: input.body,
    link: input.link,
    sourceKind: input.sourceKind,
    sourceId: input.sourceId,
  };

  const all = listChannels();
  const wanted = all.filter((c) => channels.includes(c.id));

  const deliveries: DeliveryResult[] = await Promise.all(
    wanted.map(async (c) => {
      try {
        const isReady = await c.ready(input.tenantId);
        if (!isReady) {
          return {
            channel: c.id,
            ok: false,
            deliveredAt: new Date().toISOString(),
            error: "channel-not-configured",
          };
        }
        return await c.send(msg);
      } catch (err) {
        return {
          channel: c.id,
          ok: false,
          deliveredAt: new Date().toISOString(),
          error: (err as Error).message ?? "unknown",
        };
      }
    }),
  );

  await db().notification.update({
    where: { id: row.id },
    data: { deliveries: deliveries as object },
  });

  for (const d of deliveries) {
    audit({
      action: d.ok ? "notification.sent" : "notification.failed",
      tenantId: input.tenantId,
      userId: input.userId ?? null,
      subject: row.id,
      meta: { channel: d.channel, error: d.error ?? null },
    });
  }

  return { notification: row, deliveries };
}

export async function listForTenant(tenantId: string, limit = 50) {
  return db().notification.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function markRead(tenantId: string, notificationId: string, userId: string) {
  const updated = await db().notification.updateMany({
    where: { id: notificationId, tenantId },
    data: { status: "READ", readAt: new Date() },
  });
  if (updated.count > 0) {
    audit({
      action: "notification.sent", // re-using event for read receipts is fine for now
      tenantId,
      userId,
      subject: notificationId,
      meta: { event: "read" },
    });
  }
}

// Notification orchestrator contracts.
//
// One outbound message can be fanned out to multiple channels (in-app +
// WhatsApp, in-app + email, etc.). The orchestrator persists the canonical
// Notification row first, then attempts each channel; per-channel delivery
// status is recorded in `Notification.deliveries`.
//
// Channels are pluggable — implement `NotificationChannel` and add to
// channels/index.ts. Channels MUST be idempotent on `messageId` so retries
// don't double-send.

import type { NotificationSeverity } from "@prisma/client";

export type ChannelId =
  | "in-app"
  | "email"
  | "slack"
  | "whatsapp"
  | "outlook"
  | "gmail"
  | "sms";

export interface NotificationMessage {
  // Unique id, used by channels for idempotency. Caller mints it.
  messageId: string;
  tenantId: string;
  userId?: string | null;
  severity: NotificationSeverity;
  title: string;
  body: string;
  // Deep-link target inside the workspace.
  link?: string;
  sourceKind?: string;
  sourceId?: string;
}

export interface DeliveryResult {
  channel: ChannelId;
  ok: boolean;
  deliveredAt: string; // ISO
  error?: string;
}

export interface NotificationChannel {
  id: ChannelId;
  // Returns false if channel is not configured (missing env / no user
  // token); the orchestrator treats that as a non-error skip.
  ready(tenantId: string): Promise<boolean>;
  send(msg: NotificationMessage): Promise<DeliveryResult>;
}

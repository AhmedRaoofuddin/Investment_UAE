// In-app channel — always available, always succeeds (or DB is down which
// means the whole orchestrator is broken anyway).
//
// "Sending" here just means: the canonical Notification row is already
// written by the orchestrator, so this channel is a no-op confirmation.
// We keep it as a real channel for symmetry — UI shows the in-app delivery
// alongside email/WhatsApp/etc.

import type { DeliveryResult, NotificationChannel, NotificationMessage } from "../types";

export const inAppChannel: NotificationChannel = {
  id: "in-app",
  async ready() {
    return true;
  },
  async send(_msg: NotificationMessage): Promise<DeliveryResult> {
    return {
      channel: "in-app",
      ok: true,
      deliveredAt: new Date().toISOString(),
    };
  },
};

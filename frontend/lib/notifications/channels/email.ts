// Email channel via Resend.
//
// Resend is the email-API choice for the pilot — fastest setup, sensible
// pricing, transactional templates. When you provision a domain in Resend
// dashboard and add the DNS records, set RESEND_API_KEY and FROM_EMAIL
// env vars and this channel auto-becomes "ready".

import { db } from "@/lib/db";
import type { DeliveryResult, NotificationChannel, NotificationMessage } from "../types";

function ready(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.FROM_EMAIL);
}

async function recipientEmail(tenantId: string, userId?: string | null): Promise<string | null> {
  if (userId) {
    const user = await db().user.findFirst({
      where: { id: userId, tenantId },
      select: { email: true },
    });
    return user?.email ?? null;
  }
  // Tenant-level — send to the OWNER.
  const owner = await db().user.findFirst({
    where: { tenantId, role: "OWNER" },
    select: { email: true },
  });
  return owner?.email ?? null;
}

export const emailChannel: NotificationChannel = {
  id: "email",
  async ready() {
    return ready();
  },
  async send(msg: NotificationMessage): Promise<DeliveryResult> {
    if (!ready()) {
      return {
        channel: "email",
        ok: false,
        deliveredAt: new Date().toISOString(),
        error: "channel-not-configured",
      };
    }
    const to = await recipientEmail(msg.tenantId, msg.userId);
    if (!to) {
      return {
        channel: "email",
        ok: false,
        deliveredAt: new Date().toISOString(),
        error: "no-recipient",
      };
    }

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json",
        // Idempotency-Key prevents double-send on retry.
        "Idempotency-Key": msg.messageId,
      },
      body: JSON.stringify({
        from: process.env.FROM_EMAIL,
        to,
        subject: `[${msg.severity}] ${msg.title}`,
        text: msg.body + (msg.link ? `\n\nView: ${msg.link}` : ""),
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      return {
        channel: "email",
        ok: false,
        deliveredAt: new Date().toISOString(),
        error: `resend-${resp.status}: ${detail.slice(0, 120)}`,
      };
    }
    return { channel: "email", ok: true, deliveredAt: new Date().toISOString() };
  },
};

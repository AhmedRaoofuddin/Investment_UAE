// WhatsApp Business Cloud API channel.
//
// UAE is a WhatsApp-first market for high-net-worth comms. We use Meta's
// official Cloud API (no Twilio markup). Required env:
//   WHATSAPP_PHONE_NUMBER_ID    — from Meta Business Manager
//   WHATSAPP_ACCESS_TOKEN       — system-user permanent token
//   WHATSAPP_TEMPLATE_NAMESPACE — namespace of approved templates
//
// Per WhatsApp policy, business-initiated messages outside a 24-hour
// window MUST use a pre-approved template. The pilot ships with one
// template: `signal_alert_v1` with parameters {severity, title, body, link}.
// Until the template is approved by Meta, this channel will fail with
// "template-not-approved" — that's an external dependency, not a bug.

import { db } from "@/lib/db";
import type { DeliveryResult, NotificationChannel, NotificationMessage } from "../types";

function ready(): boolean {
  return Boolean(
    process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN,
  );
}

async function recipientPhone(tenantId: string, userId?: string | null): Promise<string | null> {
  // We don't yet store phone numbers in User — this is a pilot stub.
  // Wire to the User model once we add a phone column + verification.
  void tenantId;
  void userId;
  return process.env.WHATSAPP_FALLBACK_TO ?? null;
}

export const whatsappChannel: NotificationChannel = {
  id: "whatsapp",
  async ready() {
    return ready();
  },
  async send(msg: NotificationMessage): Promise<DeliveryResult> {
    if (!ready()) {
      return {
        channel: "whatsapp",
        ok: false,
        deliveredAt: new Date().toISOString(),
        error: "channel-not-configured",
      };
    }
    const to = await recipientPhone(msg.tenantId, msg.userId);
    if (!to) {
      return {
        channel: "whatsapp",
        ok: false,
        deliveredAt: new Date().toISOString(),
        error: "no-recipient-phone",
      };
    }

    const url = `https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: "signal_alert_v1",
          language: { code: "en" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: msg.severity },
                { type: "text", text: msg.title },
                { type: "text", text: msg.body.slice(0, 800) },
                { type: "text", text: msg.link ?? "" },
              ],
            },
          ],
        },
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      return {
        channel: "whatsapp",
        ok: false,
        deliveredAt: new Date().toISOString(),
        error: `meta-${resp.status}: ${detail.slice(0, 120)}`,
      };
    }
    return { channel: "whatsapp", ok: true, deliveredAt: new Date().toISOString() };
  },
};
// Suppress unused-import warning until we wire phone to user model.
void db;

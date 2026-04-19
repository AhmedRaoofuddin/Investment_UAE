// Slack channel — posts to the channel id stored on the tenant's Slack
// connection config. The connection is created via the OAuth flow in
// providers/slack.ts; the user picks the destination channel in the
// workspace UI (TODO: channel picker).
//
// For the pilot we always post to the channel saved in
// connection.config.defaultChannelId; if absent, we skip (returns
// channel-not-configured).

import { db } from "@/lib/db";
import { readSecret } from "@/lib/connections/service";
import type { DeliveryResult, NotificationChannel, NotificationMessage } from "../types";

export const slackChannel: NotificationChannel = {
  id: "slack",
  async ready(tenantId: string) {
    const conn = await db().connection.findFirst({
      where: { tenantId, provider: "slack", status: "ACTIVE" },
    });
    return Boolean(conn);
  },
  async send(msg: NotificationMessage): Promise<DeliveryResult> {
    const conn = await db().connection.findFirst({
      where: { tenantId: msg.tenantId, provider: "slack", status: "ACTIVE" },
    });
    if (!conn) {
      return {
        channel: "slack",
        ok: false,
        deliveredAt: new Date().toISOString(),
        error: "no-connection",
      };
    }
    const cfg = (conn.config as Record<string, unknown> | null) ?? {};
    const channelId = cfg.defaultChannelId as string | undefined;
    if (!channelId) {
      return {
        channel: "slack",
        ok: false,
        deliveredAt: new Date().toISOString(),
        error: "no-default-channel",
      };
    }
    const token = await readSecret(msg.tenantId, conn.id, "access_token");
    if (!token) {
      return {
        channel: "slack",
        ok: false,
        deliveredAt: new Date().toISOString(),
        error: "no-token",
      };
    }
    const resp = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        channel: channelId,
        text: `*[${msg.severity}] ${msg.title}*\n${msg.body}${msg.link ? `\n<${msg.link}|Open workspace>` : ""}`,
      }),
    });
    const json = (await resp.json()) as { ok: boolean; error?: string };
    return {
      channel: "slack",
      ok: json.ok,
      deliveredAt: new Date().toISOString(),
      error: json.ok ? undefined : (json.error ?? "unknown"),
    };
  },
};

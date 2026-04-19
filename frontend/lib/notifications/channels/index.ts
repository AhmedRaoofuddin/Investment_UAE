// Channel registry. Add a new channel here once it implements
// NotificationChannel.

import type { ChannelId, NotificationChannel } from "../types";
import { inAppChannel } from "./inApp";
import { emailChannel } from "./email";
import { slackChannel } from "./slack";
import { whatsappChannel } from "./whatsapp";

const CHANNELS: NotificationChannel[] = [
  inAppChannel,
  emailChannel,
  slackChannel,
  whatsappChannel,
];

export function listChannels(): NotificationChannel[] {
  return CHANNELS;
}

export function getChannel(id: ChannelId): NotificationChannel | undefined {
  return CHANNELS.find((c) => c.id === id);
}

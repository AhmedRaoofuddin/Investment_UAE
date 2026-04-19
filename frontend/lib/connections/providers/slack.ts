// Slack connection — primarily a notification destination, secondarily a
// data source (channel messages can be ingested into the signal graph).
//
// We use the `chat:write` + `chat:write.public` scopes for outbound posts;
// add `channels:history` later if/when we ingest. Token type: bot.
//
// Required env:
//   SLACK_OAUTH_CLIENT_ID
//   SLACK_OAUTH_CLIENT_SECRET

import type { ConnectionProvider, OAuthGrant } from "../types";

const AUTHORIZE = "https://slack.com/oauth/v2/authorize";
const TOKEN = "https://slack.com/api/oauth.v2.access";

function ready(): boolean {
  return Boolean(
    process.env.SLACK_OAUTH_CLIENT_ID && process.env.SLACK_OAUTH_CLIENT_SECRET,
  );
}

export const slackProvider: ConnectionProvider = {
  meta: {
    id: "slack",
    kind: "OAUTH_APP",
    name: "Slack",
    description:
      "Receive watchlist alerts in Slack channels. Choose which channels per signal type.",
    iconKey: "slack",
    tiers: ["PILOT", "VERIFIED", "INSTITUTION"],
    docsUrl: "https://api.slack.com/apps",
    ready: ready(),
  },
  authorizeUrl(state) {
    const params = new URLSearchParams({
      client_id: process.env.SLACK_OAUTH_CLIENT_ID!,
      scope: "chat:write,chat:write.public,channels:read",
      state,
      redirect_uri: `${process.env.APP_ORIGIN}/api/connections/slack/callback`,
    });
    return `${AUTHORIZE}?${params.toString()}`;
  },
  async completeOAuth(code): Promise<OAuthGrant> {
    const body = new URLSearchParams({
      client_id: process.env.SLACK_OAUTH_CLIENT_ID!,
      client_secret: process.env.SLACK_OAUTH_CLIENT_SECRET!,
      code,
      redirect_uri: `${process.env.APP_ORIGIN}/api/connections/slack/callback`,
    });
    const resp = await fetch(TOKEN, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const tok = (await resp.json()) as {
      ok: boolean;
      access_token?: string;
      team?: { id: string; name: string };
      bot_user_id?: string;
      error?: string;
    };
    if (!tok.ok || !tok.access_token) {
      throw new Error(`Slack exchange failed: ${tok.error ?? "unknown"}`);
    }
    return {
      accessToken: tok.access_token,
      config: {
        teamId: tok.team?.id,
        teamName: tok.team?.name,
        botUserId: tok.bot_user_id,
      },
    };
  },
};

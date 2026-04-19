// Notion connection provider — read-only workspace pages.
//
// Required env:
//   NOTION_OAUTH_CLIENT_ID
//   NOTION_OAUTH_CLIENT_SECRET
// Redirect URI:
//   {APP_ORIGIN}/api/connections/notion/callback

import type { ConnectionProvider, OAuthGrant } from "../types";

const AUTHORIZE = "https://api.notion.com/v1/oauth/authorize";
const TOKEN = "https://api.notion.com/v1/oauth/token";

function ready(): boolean {
  return Boolean(
    process.env.NOTION_OAUTH_CLIENT_ID && process.env.NOTION_OAUTH_CLIENT_SECRET,
  );
}

export const notionProvider: ConnectionProvider = {
  meta: {
    id: "notion",
    kind: "OAUTH_APP",
    name: "Notion",
    description:
      "Pull pages and databases from your Notion workspace into the agent context.",
    iconKey: "notion",
    tiers: ["PILOT", "VERIFIED", "INSTITUTION"],
    docsUrl: "https://developers.notion.com",
    ready: ready(),
  },
  authorizeUrl(state) {
    const params = new URLSearchParams({
      client_id: process.env.NOTION_OAUTH_CLIENT_ID!,
      response_type: "code",
      owner: "user",
      redirect_uri: `${process.env.APP_ORIGIN}/api/connections/notion/callback`,
      state,
    });
    return `${AUTHORIZE}?${params.toString()}`;
  },
  async completeOAuth(code): Promise<OAuthGrant> {
    const auth = Buffer.from(
      `${process.env.NOTION_OAUTH_CLIENT_ID}:${process.env.NOTION_OAUTH_CLIENT_SECRET}`,
    ).toString("base64");
    const resp = await fetch(TOKEN, {
      method: "POST",
      headers: {
        authorization: `Basic ${auth}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${process.env.APP_ORIGIN}/api/connections/notion/callback`,
      }),
    });
    if (!resp.ok) throw new Error(`Notion exchange failed: ${resp.status}`);
    const tok = (await resp.json()) as {
      access_token: string;
      workspace_id: string;
      workspace_name: string;
      bot_id: string;
    };
    return {
      accessToken: tok.access_token,
      config: {
        workspaceId: tok.workspace_id,
        workspaceName: tok.workspace_name,
        botId: tok.bot_id,
      },
    };
  },
};

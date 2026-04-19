// Google Drive connection provider.
//
// Pilot scope: read-only file metadata + content (drive.readonly). The agent
// uses this to surface investor-facing documents (term sheets, PDFs) into
// the workspace canvas. We never write back.
//
// Required env (pilot can leave unset — provider stays "not ready" in UI):
//   GOOGLE_OAUTH_CLIENT_ID
//   GOOGLE_OAUTH_CLIENT_SECRET
// Redirect URI to register in Google Cloud Console:
//   {APP_ORIGIN}/api/connections/google-drive/callback

import type { ConnectionProvider, OAuthGrant } from "../types";
import { buildAuthorizeUrl, exchangeCode } from "./_oauthHelper";

const AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "openid",
  "email",
];

function ready(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  );
}

function redirectUri(): string {
  const origin = process.env.APP_ORIGIN ?? "http://localhost:3000";
  return `${origin}/api/connections/google-drive/callback`;
}

export const googleDriveProvider: ConnectionProvider = {
  meta: {
    id: "google-drive",
    kind: "OAUTH_APP",
    name: "Google Drive",
    description:
      "Read-only access to investor documents: term sheets, decks, due-diligence PDFs.",
    iconKey: "drive",
    tiers: ["PILOT", "VERIFIED", "INSTITUTION"],
    docsUrl: "https://developers.google.com/drive",
    ready: ready(),
  },
  authorizeUrl(state) {
    if (!ready()) throw new Error("Google OAuth not configured");
    // PKCE verifier stored in cookie by the route handler before redirect.
    return buildAuthorizeUrl({
      authorizeEndpoint: AUTHORIZE,
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      redirectUri: redirectUri(),
      scopes: SCOPES,
      state,
      // Replaced with real S256 challenge by route handler.
      codeChallenge: state,
      extraParams: { access_type: "offline", prompt: "consent" },
    });
  },
  async completeOAuth(code, _state): Promise<OAuthGrant> {
    if (!ready()) throw new Error("Google OAuth not configured");
    // codeVerifier injected by route handler via mutable closure.
    const verifier = (globalThis as Record<string, unknown>)
      .__google_drive_verifier as string | undefined;
    if (!verifier) throw new Error("Missing PKCE verifier");
    const tok = await exchangeCode({
      tokenEndpoint: TOKEN,
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      code,
      redirectUri: redirectUri(),
      codeVerifier: verifier,
    });
    return {
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token,
      expiresAt: tok.expires_in
        ? new Date(Date.now() + tok.expires_in * 1000)
        : undefined,
      config: { scope: tok.scope ?? SCOPES.join(" ") },
    };
  },
};

// Shared OAuth 2.1 + PKCE helper for all OAuth providers.
//
// Implementations call `oauthAuthorizeUrl` to produce the consent URL and
// `oauthExchangeCode` to redeem the code at the provider's token endpoint.
// PKCE verifier + state both live in the user session (HttpOnly cookie
// written by the route handler) so a stolen code can't be redeemed without
// the verifier and a CSRF attacker can't forge a callback.

import { createHash, randomBytes } from "node:crypto";

export function generateCodeVerifier(): string {
  return base64url(randomBytes(32));
}

export function challengeFromVerifier(verifier: string): string {
  return base64url(createHash("sha256").update(verifier).digest());
}

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export interface AuthorizeOpts {
  authorizeEndpoint: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
  codeChallenge: string;
  extraParams?: Record<string, string>;
}

export function buildAuthorizeUrl(opts: AuthorizeOpts): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    scope: opts.scopes.join(" "),
    state: opts.state,
    code_challenge: opts.codeChallenge,
    code_challenge_method: "S256",
    ...(opts.extraParams ?? {}),
  });
  return `${opts.authorizeEndpoint}?${params.toString()}`;
}

export interface ExchangeOpts {
  tokenEndpoint: string;
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  [key: string]: unknown;
}

export async function exchangeCode(opts: ExchangeOpts): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    code: opts.code,
    redirect_uri: opts.redirectUri,
    code_verifier: opts.codeVerifier,
  });
  const resp = await fetch(opts.tokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(`OAuth token exchange failed: ${resp.status} ${detail}`);
  }
  return (await resp.json()) as TokenResponse;
}

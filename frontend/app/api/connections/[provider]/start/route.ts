// Connection start handler.
//
// For OAUTH_APP providers: mints a per-flow `state` (CSRF token), stores it
// in an HttpOnly cookie alongside the PKCE verifier, and redirects to the
// provider's authorize URL.
//
// For API_KEY providers: redirects to the workspace UI's paste form (TODO).
//
// For MCP_SERVER providers: only enabled tiers see the route; falls through
// to a static "request access" page (TODO).

import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { getProvider } from "@/lib/connections/registry";
import { getSessionOrNull } from "@/lib/security/session";

const STATE_COOKIE = "oauth_state";
const VERIFIER_COOKIE = "oauth_verifier";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ provider: string }> },
) {
  const session = await getSessionOrNull();
  if (!session) {
    return NextResponse.redirect(new URL("/auth/signin", req.url));
  }

  const { provider } = await ctx.params;
  const p = getProvider(provider);
  if (!p) return new NextResponse("Unknown provider", { status: 404 });
  if (!p.meta.ready) {
    return new NextResponse("Provider not yet enabled", { status: 503 });
  }

  if (p.meta.kind === "OAUTH_APP" && p.authorizeUrl) {
    const state = randomBytes(16).toString("hex");
    const verifier = randomBytes(32).toString("base64url");
    const url = p.authorizeUrl(state);
    const res = NextResponse.redirect(url);
    res.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: `/api/connections/${provider}`,
      maxAge: 600,
    });
    res.cookies.set(VERIFIER_COOKIE, verifier, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: `/api/connections/${provider}`,
      maxAge: 600,
    });
    return res;
  }

  if (p.meta.kind === "API_KEY") {
    return NextResponse.redirect(
      new URL(`/workspace/connections?paste=${provider}`, req.url),
    );
  }

  return NextResponse.redirect(new URL("/workspace/connections", req.url));
}

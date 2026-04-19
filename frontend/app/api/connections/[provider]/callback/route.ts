// Generic OAuth callback handler.
//
// Validates the state cookie (CSRF), pulls the PKCE verifier out of the
// matching cookie, hands the code to the provider's `completeOAuth`, and
// stores the resulting tokens via the encrypted vault.

import { NextResponse, type NextRequest } from "next/server";
import { getProvider } from "@/lib/connections/registry";
import { getSessionOrNull } from "@/lib/security/session";
import { upsertOAuthConnection } from "@/lib/connections/service";
import { audit } from "@/lib/audit";

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
  if (!p?.completeOAuth) {
    return new NextResponse("Provider does not support OAuth", { status: 400 });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const cookieState = req.cookies.get("oauth_state")?.value;
  const verifier = req.cookies.get("oauth_verifier")?.value;

  if (error || !code || !state) {
    audit({
      action: "auth.failed",
      tenantId: session.tenantId,
      userId: session.userId,
      subject: provider,
      meta: { reason: error ?? "missing-params" },
    });
    return NextResponse.redirect(
      new URL(`/workspace/connections?error=${encodeURIComponent(error ?? "missing")}`, req.url),
    );
  }
  if (!cookieState || cookieState !== state) {
    audit({
      action: "auth.failed",
      tenantId: session.tenantId,
      userId: session.userId,
      subject: provider,
      meta: { reason: "state-mismatch" },
    });
    return new NextResponse("State mismatch", { status: 400 });
  }

  // Make verifier available to provider (Google needs PKCE; the provider
  // file reads from this global).
  (globalThis as Record<string, unknown>).__google_drive_verifier = verifier;

  try {
    const grant = await p.completeOAuth(code, state);
    await upsertOAuthConnection({
      tenantId: session.tenantId,
      userId: session.userId,
      provider,
      grant,
      ip: req.headers.get("x-forwarded-for") ?? undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
  } catch (err) {
    audit({
      action: "connection.updated",
      tenantId: session.tenantId,
      userId: session.userId,
      subject: provider,
      meta: { error: (err as Error).message },
    });
    return NextResponse.redirect(
      new URL(`/workspace/connections?error=exchange-failed`, req.url),
    );
  }

  const res = NextResponse.redirect(new URL("/workspace/connections", req.url));
  // Clear the single-use cookies regardless of outcome.
  res.cookies.delete("oauth_state");
  res.cookies.delete("oauth_verifier");
  return res;
}

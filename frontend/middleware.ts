// Edge middleware — runs on every request.
//
// Responsibilities, in order:
//   1. Apply security headers (CSP nonce, HSTS, X-Frame-Options, etc.).
//   2. Apply route-specific rate limits.
//   3. Gate /workspace/* on a valid Auth.js session cookie. (We do a cheap
//      cookie-presence check here; the full session validation happens in
//      server components via `auth()`. Cookie presence is enough to send
//      anonymous traffic to /auth/signin without a DB hit per request.)
//
// What we do NOT do here: full session resolution (would force every
// request through Postgres), tenant-row checks (those belong in server
// components / route handlers where the query happens anyway).

import { NextResponse, type NextRequest } from "next/server";
import { generateNonce, securityHeaders } from "@/lib/security/headers";
import { rateLimit, POLICIES } from "@/lib/security/rateLimit";

const AUTH_COOKIE_NAMES = [
  // Auth.js v5 cookie names (host-only for prod, regular for dev)
  "__Secure-authjs.session-token",
  "authjs.session-token",
];

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "anonymous";
}

function hasSessionCookie(req: NextRequest): boolean {
  return AUTH_COOKIE_NAMES.some((n) => req.cookies.get(n));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = clientIp(req);

  // ── Rate limits (per-policy) ───────────────────────────────────────
  if (pathname.startsWith("/api/auth/signin") || pathname.startsWith("/auth/signin")) {
    const rl = rateLimit(`auth:${ip}`, POLICIES.AUTH_SIGNIN.capacity, POLICIES.AUTH_SIGNIN.windowMs);
    if (!rl.ok) return tooManyRequests(rl.resetMs);
  } else if (pathname.startsWith("/api/workspace")) {
    const rl = rateLimit(`ws:${ip}`, POLICIES.WORKSPACE_API.capacity, POLICIES.WORKSPACE_API.windowMs);
    if (!rl.ok) return tooManyRequests(rl.resetMs);
  } else if (pathname.startsWith("/api/connections")) {
    const rl = rateLimit(`conn:${ip}`, POLICIES.CONNECTIONS_WRITE.capacity, POLICIES.CONNECTIONS_WRITE.windowMs);
    if (!rl.ok) return tooManyRequests(rl.resetMs);
  }

  // ── Auth gate for /workspace/* ─────────────────────────────────────
  if (pathname.startsWith("/workspace")) {
    if (!hasSessionCookie(req)) {
      const url = req.nextUrl.clone();
      url.pathname = "/auth/signin";
      url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }
  }

  // ── Security headers ───────────────────────────────────────────────
  const nonce = generateNonce();
  const res = NextResponse.next({
    request: { headers: new Headers({ ...Object.fromEntries(req.headers), "x-nonce": nonce }) },
  });
  for (const [k, v] of Object.entries(securityHeaders(nonce))) {
    res.headers.set(k, v);
  }
  return res;
}

function tooManyRequests(resetMs: number): NextResponse {
  return new NextResponse(JSON.stringify({ error: "rate_limited", retry_after_ms: resetMs }), {
    status: 429,
    headers: {
      "content-type": "application/json",
      "retry-after": String(Math.ceil(resetMs / 1000)),
    },
  });
}

export const config = {
  // Apply to everything except Next.js internals + static assets. The
  // matcher excludes _next/static, _next/image, favicon, and our brand /
  // partners / sources directories so we don't pay the security-header
  // computation cost on every image request.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg|brand/.*|partners/.*|sources/.*).*)",
  ],
};

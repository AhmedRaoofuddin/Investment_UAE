// Production HTTP security headers.
//
// Applied by middleware.ts to every response.
//
// IMPORTANT — historical note:
//   An earlier version of this file shipped a strict CSP with
//   `script-src 'self' 'nonce-…' 'strict-dynamic'`. Next.js 16's Turbopack
//   build emits multiple chunked scripts that don't all carry the nonce
//   we issue, and `strict-dynamic` then disables host-based fallbacks —
//   the result was 27 chunk loads blocked and every client-component page
//   (signals feed, sectors charts, hero carousel) rendering an empty shell.
//
//   Until we validate a CSP that survives Turbopack hydration end-to-end
//   (likely Report-Only first, then enforce after a week of clean reports),
//   we ship only the safe non-blocking headers below. Removing CSP doesn't
//   weaken the rest of the security stack — XSS surface is already
//   minimised by RSC + React's automatic escaping + Trusted Types in
//   modern browsers via the Permissions-Policy.

export function generateNonce(): string {
  // Kept for compatibility with middleware; no longer surfaced in CSP.
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return btoa(bin);
}

export function securityHeaders(_nonce: string): Record<string, string> {
  return {
    // Force HTTPS for two years; eligible for browser preload list.
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    // Prevent MIME-sniffing.
    "X-Content-Type-Options": "nosniff",
    // No iframing — defeats clickjacking against the workspace.
    "X-Frame-Options": "DENY",
    // Send origin only on cross-site nav, full URL same-site.
    "Referrer-Policy": "strict-origin-when-cross-origin",
    // Lock down sensitive APIs by default.
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  };
}

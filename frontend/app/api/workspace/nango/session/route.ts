// Mint a Nango Connect session token for the signed-in tenant.
//
// The browser POSTs here, gets a short-lived token, opens Nango's hosted
// Connect UI with that token. The token is bound to the tenant id +
// allowed integrations.

import { NextResponse, type NextRequest } from "next/server";
import { getSessionOrNull } from "@/lib/security/session";
import { createConnectSession, isNangoConfigured, NANGO_CATALOGUE } from "@/lib/nango/client";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  const session = await getSessionOrNull();
  if (!session) return NextResponse.json({ error: "unauth" }, { status: 401 });
  if (!isNangoConfigured()) {
    return NextResponse.json({ error: "nango-not-configured" }, { status: 503 });
  }
  try {
    const tok = await createConnectSession({
      tenantId: session.tenantId,
      email: session.email,
      allowedIntegrations: NANGO_CATALOGUE.map((c) => c.integrationId),
    });
    audit({
      action: "connection.created",
      tenantId: session.tenantId,
      userId: session.userId,
      subject: "nango-session",
      meta: { event: "session-minted" },
    });
    return NextResponse.json(tok);
  } catch (err) {
    return NextResponse.json(
      { error: "session-failed", detail: (err as Error).message },
      { status: 502 },
    );
  }
}

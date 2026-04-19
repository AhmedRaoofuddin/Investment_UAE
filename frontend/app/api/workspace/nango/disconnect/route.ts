// Disconnect a Nango integration for the current tenant.

import { NextResponse, type NextRequest } from "next/server";
import { getSessionOrNull } from "@/lib/security/session";
import { buildConnectionId, deleteNangoConnection, isNangoConfigured } from "@/lib/nango/client";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSessionOrNull();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (!isNangoConfigured()) return new NextResponse("Nango not configured", { status: 503 });
  const form = await req.formData();
  const integrationId = String(form.get("integrationId") ?? "");
  if (!integrationId) return new NextResponse("integrationId required", { status: 400 });

  // We use a deterministic connectionId, but Nango may have the user's
  // real OAuth connection id from a previous session. Look up by endUserId
  // would be safer; for simplicity we try the deterministic id first.
  await deleteNangoConnection({
    integrationId,
    connectionId: buildConnectionId(session.tenantId, integrationId),
  });

  audit({
    action: "connection.revoked",
    tenantId: session.tenantId,
    userId: session.userId,
    subject: integrationId,
    meta: { via: "nango" },
  });
  return NextResponse.redirect(new URL("/workspace/connections", req.url), 303);
}

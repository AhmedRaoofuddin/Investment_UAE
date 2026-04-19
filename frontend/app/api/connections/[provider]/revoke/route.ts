// Revoke a connection. POST-only — must come from a workspace form submit
// (CSRF: SameSite=Lax cookie + same-origin form).

import { NextResponse, type NextRequest } from "next/server";
import { db, isDbConfigured } from "@/lib/db";
import { revokeConnection } from "@/lib/connections/service";
import { getSessionOrNull } from "@/lib/security/session";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ provider: string }> },
) {
  const session = await getSessionOrNull();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (!isDbConfigured) return new NextResponse("DB not configured", { status: 503 });

  const { provider } = await ctx.params;
  const conn = await db().connection.findFirst({
    where: { tenantId: session.tenantId, provider },
  });
  if (!conn) return NextResponse.redirect(new URL("/workspace/connections", req.url));

  await revokeConnection({
    tenantId: session.tenantId,
    userId: session.userId,
    connectionId: conn.id,
  });
  return NextResponse.redirect(new URL("/workspace/connections", req.url));
}

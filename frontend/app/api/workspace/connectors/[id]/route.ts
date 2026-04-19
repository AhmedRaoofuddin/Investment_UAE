// DELETE a saved connector for this tenant. Hard-deletes the ciphertext
// secrets; flips the Connection row to REVOKED so the audit trail
// survives. Idempotent — a second DELETE on the same id returns 200 with
// no body.

import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { db, isDbConfigured } from "@/lib/db";
import { requireSession } from "@/lib/security/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const session = await requireSession();
  if (!isDbConfigured) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }
  const { id } = await ctx.params;

  const conn = await db().connection.findFirst({
    where: { id, tenantId: session.tenantId },
  });
  if (!conn) {
    return NextResponse.json({ ok: true, alreadyGone: true });
  }

  await db().connectionSecret.deleteMany({ where: { connectionId: conn.id } });
  await db().connection.update({
    where: { id: conn.id },
    data: { status: "REVOKED", updatedAt: new Date() },
  });

  audit({
    action: "connector.revoked",
    tenantId: session.tenantId,
    userId: session.userId,
    subject: conn.id,
    meta: { provider: conn.provider },
  });

  return NextResponse.json({ ok: true });
}

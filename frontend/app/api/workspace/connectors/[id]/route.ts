// GET  → return non-secret metadata for the connection (for the Manage modal).
// DELETE → hard-delete ciphertext secrets; flip row to REVOKED.

import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { db, isDbConfigured } from "@/lib/db";
import { requireSession } from "@/lib/security/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: RouteCtx) {
  const session = await requireSession();
  if (!isDbConfigured) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }
  const { id } = await ctx.params;

  const conn = await db().connection.findFirst({
    where: { id, tenantId: session.tenantId },
    select: {
      id: true,
      provider: true,
      status: true,
      label: true,
      config: true,
      createdAt: true,
      updatedAt: true,
      lastError: true,
      // ConnectionSecret rows are NOT included — never expose ciphertext
      _count: { select: { secrets: true } },
    },
  });
  if (!conn) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    id: conn.id,
    provider: conn.provider,
    status: conn.status,
    label: conn.label,
    config: conn.config,
    hasSecrets: conn._count.secrets > 0,
    createdAt: conn.createdAt,
    updatedAt: conn.updatedAt,
    lastError: conn.lastError,
  });
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

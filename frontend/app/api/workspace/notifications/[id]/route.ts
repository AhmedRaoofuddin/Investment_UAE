// Notification actions: mark read, mark unread, archive.
// POST with form field `action` set to one of: read, unread, archive.

import { NextResponse, type NextRequest } from "next/server";
import { db, isDbConfigured } from "@/lib/db";
import { getSessionOrNull } from "@/lib/security/session";
import { audit } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSessionOrNull();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (!isDbConfigured) return new NextResponse("DB not configured", { status: 503 });
  const { id } = await ctx.params;
  const form = await req.formData().catch(() => null);
  const action = String(form?.get("action") ?? "");

  let data: { status: "READ" | "UNREAD" | "ARCHIVED"; readAt: Date | null } | null = null;
  if (action === "read") data = { status: "READ", readAt: new Date() };
  else if (action === "unread") data = { status: "UNREAD", readAt: null };
  else if (action === "archive") data = { status: "ARCHIVED", readAt: new Date() };
  if (!data) return new NextResponse("Bad action", { status: 400 });

  const result = await db().notification.updateMany({
    where: { id, tenantId: session.tenantId },
    data,
  });
  if (result.count > 0) {
    audit({
      action: "notification.sent",
      tenantId: session.tenantId,
      userId: session.userId,
      subject: id,
      meta: { event: action },
    });
  }
  return NextResponse.redirect(new URL("/workspace/notifications", req.url), 303);
}

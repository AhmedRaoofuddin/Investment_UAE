// Remove a watchlist item. POST with `_method=DELETE` from a plain HTML
// form (browsers don't natively support DELETE forms). Tenant scoping is
// enforced via the WHERE clause — we never look up by id alone.

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
  const method = form?.get("_method");
  if (method !== "DELETE") return new NextResponse("Method not allowed", { status: 405 });

  const result = await db().watchlistItem.deleteMany({
    where: { id, tenantId: session.tenantId },
  });
  if (result.count > 0) {
    audit({
      action: "watchlist.removed",
      tenantId: session.tenantId,
      userId: session.userId,
      subject: id,
    });
  }
  return NextResponse.redirect(new URL("/workspace/watchlist", req.url), 303);
}

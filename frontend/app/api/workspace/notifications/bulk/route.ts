// Bulk notification actions.
//
// POST /api/workspace/notifications/bulk
//   form field `scope`: "ai-summary" | "read" | "all"
//
// Always archives (never hard-deletes) — the schema keeps the row, only
// flips the status so the audit trail + history stay intact. ARCHIVED
// items drop out of both the inbox list and the "unread" counter but
// can still be reviewed on the `?view=archived` tab.
//
// Rate-limited by the workspace-write bucket via middleware. Every bulk
// op emits a single audit entry with the scope + count; per-item rows
// would flood the audit log for no forensic benefit.

import { NextResponse, type NextRequest } from "next/server";
import { db, isDbConfigured } from "@/lib/db";
import { getSessionOrNull } from "@/lib/security/session";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Scope = "ai-summary" | "read" | "all";

export async function POST(req: NextRequest) {
  const session = await getSessionOrNull();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (!isDbConfigured) return new NextResponse("DB not configured", { status: 503 });

  const form = await req.formData().catch(() => null);
  const raw = String(form?.get("scope") ?? "");
  const scope: Scope | null =
    raw === "ai-summary" || raw === "read" || raw === "all" ? raw : null;
  if (!scope) return new NextResponse("Bad scope", { status: 400 });

  // Scope the where clause; tenantId is always included so we never
  // touch another tenant's rows.
  const where: {
    tenantId: string;
    status?: { not: "ARCHIVED" } | "READ";
    sourceKind?: string;
  } = {
    tenantId: session.tenantId,
    status: { not: "ARCHIVED" },
  };
  if (scope === "ai-summary") {
    where.sourceKind = "ai-summary";
  } else if (scope === "read") {
    where.status = "READ";
  }

  const result = await db().notification.updateMany({
    where,
    data: { status: "ARCHIVED", readAt: new Date() },
  });

  audit({
    action: "notification.sent",
    tenantId: session.tenantId,
    userId: session.userId,
    subject: `bulk:${scope}`,
    meta: { event: "bulk-archive", scope, count: result.count },
  });

  return NextResponse.redirect(
    new URL(`/workspace/notifications?info=archived-${result.count}`, req.url),
    303,
  );
}

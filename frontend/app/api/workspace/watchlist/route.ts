// Add a watchlist item. Form-encoded POST so we get free progressive
// enhancement (no JS required) — server action would also work but route
// handlers play nicer with the per-route rate-limit middleware.

import { NextResponse, type NextRequest } from "next/server";
import { db, isDbConfigured } from "@/lib/db";
import { getSessionOrNull } from "@/lib/security/session";
import { audit } from "@/lib/audit";
import type { WatchlistItemKind } from "@prisma/client";

const KINDS: WatchlistItemKind[] = ["COMPANY", "SECTOR", "REGION", "KEYWORD"];

export async function POST(req: NextRequest) {
  const session = await getSessionOrNull();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (!isDbConfigured) return new NextResponse("DB not configured", { status: 503 });

  const form = await req.formData();
  const kind = String(form.get("kind") ?? "");
  const value = String(form.get("value") ?? "").trim();
  const label = String(form.get("label") ?? "").trim();

  if (!KINDS.includes(kind as WatchlistItemKind) || !value || !label) {
    return new NextResponse("Bad input", { status: 400 });
  }

  const item = await db().watchlistItem.upsert({
    where: {
      tenantId_kind_value: {
        tenantId: session.tenantId,
        kind: kind as WatchlistItemKind,
        value,
      },
    },
    create: {
      tenantId: session.tenantId,
      kind: kind as WatchlistItemKind,
      value,
      label,
    },
    update: { label },
  });

  audit({
    action: "watchlist.added",
    tenantId: session.tenantId,
    userId: session.userId,
    subject: item.id,
    meta: { kind, value },
  });

  // 303 forces the browser to follow with GET (default 307 keeps POST,
  // which would re-submit the form on every refresh and looks like a dup).
  return NextResponse.redirect(new URL("/workspace/watchlist", req.url), 303);
}

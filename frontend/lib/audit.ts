// Append-only audit log.
//
// Every state change, every AI decision, every export goes through here.
// Writes are fire-and-forget — we never want to fail a user action because
// the audit insert errored, but we DO want to alert ourselves. In production
// the catch path should fan out to Sentry / Sentinel; for the pilot it just
// logs to stderr.
//
// IMPORTANT: never put a secret (token, password, prompt body) in `meta`.
// The audit table is queried by ops; treat it as low-trust.

import { db, isDbConfigured } from "@/lib/db";

export type AuditAction =
  | "auth.signin"
  | "auth.signout"
  | "auth.failed"
  | "tenant.created"
  | "user.invited"
  | "connection.created"
  | "connection.updated"
  | "connection.revoked"
  | "connector.saved"
  | "connector.revoked"
  | "watchlist.added"
  | "watchlist.removed"
  | "notification.sent"
  | "notification.failed"
  | "ai.decision"
  | "ai.refused"
  | "export.created"
  | "rate_limit.tripped"
  | "daily_digest.created";

export interface AuditInput {
  action: AuditAction;
  tenantId?: string | null;
  userId?: string | null;
  subject?: string | null;
  meta?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}

export function audit(entry: AuditInput): void {
  if (!isDbConfigured) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[audit:no-db]", entry.action, entry.subject ?? "", entry.meta ?? {});
    }
    return;
  }

  // Fire-and-forget. We intentionally do NOT await — audit must never block.
  void db()
    .auditEntry.create({
      data: {
        action: entry.action,
        tenantId: entry.tenantId ?? null,
        userId: entry.userId ?? null,
        subject: entry.subject ?? null,
        meta: (entry.meta as object) ?? null,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
      },
    })
    .catch((err) => {
      // Never throw out of an audit call. Log loudly so ops can alarm on it.
      console.error("[audit:write-failed]", entry.action, err);
    });
}

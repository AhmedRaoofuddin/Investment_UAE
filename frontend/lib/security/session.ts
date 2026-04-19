// Session helpers shared by middleware + route handlers.
//
// Auth.js v5 owns the cookie + DB session lifecycle. These helpers are thin
// wrappers that:
//   1. Pull the session in a server-component-safe way.
//   2. Throw a typed AuthRequiredError if absent — caught upstream and
//      converted to a 401 / redirect, depending on the caller.
//   3. Surface the tenant id explicitly so query sites can't accidentally
//      read another tenant's data.

import { auth } from "@/lib/auth";

export class AuthRequiredError extends Error {
  constructor() {
    super("AUTH_REQUIRED");
    this.name = "AuthRequiredError";
  }
}

export interface AuthedSession {
  userId: string;
  tenantId: string;
  email: string;
  role: "OWNER" | "MEMBER" | "READONLY";
}

export async function requireSession(): Promise<AuthedSession> {
  const session = await auth();
  if (!session?.user?.id || !session.tenantId) {
    throw new AuthRequiredError();
  }
  return {
    userId: session.user.id,
    tenantId: session.tenantId,
    email: session.user.email ?? "",
    role: (session.role ?? "OWNER") as AuthedSession["role"],
  };
}

export async function getSessionOrNull(): Promise<AuthedSession | null> {
  try {
    return await requireSession();
  } catch {
    return null;
  }
}

// Connections service — the only module allowed to touch
// Connection / ConnectionSecret rows.
//
// Why centralise: we can keep the encryption layer + the audit log + the
// per-tenant access checks in one place instead of scattering them across
// route handlers. If a route bypasses this and writes secrets directly,
// our threat model breaks.

import { db } from "@/lib/db";
import { sealSecret, openSecret } from "@/lib/security/encryption";
import { audit } from "@/lib/audit";
import { getProvider } from "./registry";
import type { OAuthGrant } from "./types";

export async function listConnections(tenantId: string) {
  return db().connection.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });
}

export async function upsertOAuthConnection(args: {
  tenantId: string;
  userId: string;
  provider: string;
  grant: OAuthGrant;
  ip?: string;
  userAgent?: string;
}) {
  const meta = getProvider(args.provider)?.meta;
  if (!meta) throw new Error(`Unknown provider ${args.provider}`);

  const conn = await db().connection.upsert({
    where: {
      tenantId_provider: { tenantId: args.tenantId, provider: args.provider },
    },
    create: {
      tenantId: args.tenantId,
      provider: args.provider,
      kind: meta.kind,
      status: "ACTIVE",
      label: meta.name,
      config: args.grant.config as object,
    },
    update: {
      status: "ACTIVE",
      lastError: null,
      config: args.grant.config as object,
      updatedAt: new Date(),
    },
  });

  await persistSecret(args.tenantId, conn.id, "access_token", args.grant.accessToken, args.grant.expiresAt);
  if (args.grant.refreshToken) {
    await persistSecret(args.tenantId, conn.id, "refresh_token", args.grant.refreshToken);
  }

  audit({
    action: "connection.created",
    tenantId: args.tenantId,
    userId: args.userId,
    subject: conn.id,
    meta: { provider: args.provider, kind: meta.kind },
    ip: args.ip,
    userAgent: args.userAgent,
  });

  return conn;
}

export async function upsertApiKeyConnection(args: {
  tenantId: string;
  userId: string;
  provider: string;
  apiKey: string;
  config?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}) {
  const meta = getProvider(args.provider)?.meta;
  if (!meta) throw new Error(`Unknown provider ${args.provider}`);

  const conn = await db().connection.upsert({
    where: {
      tenantId_provider: { tenantId: args.tenantId, provider: args.provider },
    },
    create: {
      tenantId: args.tenantId,
      provider: args.provider,
      kind: meta.kind,
      status: "ACTIVE",
      label: meta.name,
      config: (args.config ?? {}) as object,
    },
    update: {
      status: "ACTIVE",
      lastError: null,
      updatedAt: new Date(),
    },
  });

  await persistSecret(args.tenantId, conn.id, "api_key", args.apiKey);

  audit({
    action: "connection.created",
    tenantId: args.tenantId,
    userId: args.userId,
    subject: conn.id,
    meta: { provider: args.provider, kind: meta.kind },
    ip: args.ip,
    userAgent: args.userAgent,
  });

  return conn;
}

export async function revokeConnection(args: {
  tenantId: string;
  userId: string;
  connectionId: string;
}) {
  const conn = await db().connection.findFirst({
    where: { id: args.connectionId, tenantId: args.tenantId },
  });
  if (!conn) throw new Error("Connection not found");

  await db().connection.update({
    where: { id: conn.id },
    data: { status: "REVOKED" },
  });
  // Hard-delete the secret material — we want forensics on the connection
  // row but no leftover ciphertext for a revoked credential.
  await db().connectionSecret.deleteMany({ where: { connectionId: conn.id } });

  audit({
    action: "connection.revoked",
    tenantId: args.tenantId,
    userId: args.userId,
    subject: conn.id,
    meta: { provider: conn.provider },
  });
}

// Internal: read a decrypted secret. Callers MUST be server-only and MUST
// pass the tenant id of the requesting session — we re-validate it here.
export async function readSecret(
  tenantId: string,
  connectionId: string,
  kind: "access_token" | "refresh_token" | "api_key",
): Promise<string | null> {
  const conn = await db().connection.findFirst({
    where: { id: connectionId, tenantId },
    include: { secrets: { where: { kind } } },
  });
  if (!conn || !conn.secrets[0]) return null;
  const sec = conn.secrets[0];
  // Prisma returns Uint8Array; encryption helper accepts either via Buffer.from.
  return openSecret(tenantId, {
    ciphertext: Buffer.from(sec.ciphertext as Uint8Array),
    iv: Buffer.from(sec.iv as Uint8Array),
    authTag: Buffer.from(sec.authTag as Uint8Array),
  });
}

async function persistSecret(
  tenantId: string,
  connectionId: string,
  kind: string,
  plaintext: string,
  expiresAt?: Date,
) {
  const sealed = sealSecret(tenantId, plaintext);
  // Prisma 6 Bytes columns expect Uint8Array on Node 22+. Buffer is a
  // subclass but TS narrows the public type so we cast through Uint8Array.
  const ct = new Uint8Array(sealed.ciphertext);
  const iv = new Uint8Array(sealed.iv);
  const tag = new Uint8Array(sealed.authTag);
  await db().connectionSecret.upsert({
    where: { connectionId_kind: { connectionId, kind } },
    create: {
      connectionId,
      kind,
      ciphertext: ct,
      iv,
      authTag: tag,
      expiresAt: expiresAt ?? null,
    },
    update: {
      ciphertext: ct,
      iv,
      authTag: tag,
      expiresAt: expiresAt ?? null,
    },
  });
}

// Prisma client singleton.
//
// Why singleton: in dev, Next.js HMR reloads modules constantly. Without a
// global cache we'd open a new Postgres pool on every reload and exhaust
// connections within minutes.
//
// Why lazy: the workspace v2 surface is additive. The marketing + platform
// pages don't need the DB. We only construct the client when something
// actually imports `db`. If POSTGRES_PRISMA_URL is unset (local dev with no
// DB provisioned yet), `db.ready` is false and callers should render an
// "unconfigured" empty state instead of crashing.

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function makeClient(): PrismaClient | null {
  if (!process.env.POSTGRES_PRISMA_URL && !process.env.DATABASE_URL) {
    return null;
  }
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "production"
        ? ["error"]
        : ["error", "warn"],
  });
}

const _client = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production" && _client) {
  globalForPrisma.prisma = _client;
}

export const isDbConfigured = _client !== null;

// Throws when called without a configured DB. Use `isDbConfigured` first if
// the calling surface should degrade gracefully (e.g. server components on
// pages that render an empty state).
export function db(): PrismaClient {
  if (!_client) {
    throw new Error(
      "Database not configured. Set POSTGRES_PRISMA_URL (Vercel Postgres) " +
        "or DATABASE_URL and run `npx prisma migrate deploy`.",
    );
  }
  return _client;
}

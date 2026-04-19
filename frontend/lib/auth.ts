// Auth.js v5 — email + password (Credentials provider).
//
// Pilot strategy:
//   - Credentials provider with bcrypt password hashes stored on User.
//   - JWT session strategy (Credentials provider in Auth.js v5 requires JWT).
//     The JWT is signed with AUTH_SECRET, set as an HttpOnly + Secure cookie,
//     and is opaque to the browser. The "no JWTs in browser" rule from the
//     v2 plan was about access tokens in localStorage — HttpOnly session
//     cookies are the standard, secure pattern.
//   - tenantId + role are encoded into the JWT during sign-in so every
//     server route can read them without a DB hit.
//   - Magic-link (Resend) and OAuth providers can be added by appending to
//     the `providers` array later. Credentials + others coexist fine.
//
// Required env:
//   AUTH_SECRET — random 32 bytes (used to sign the JWT)
//   AUTH_URL    — full origin
//   POSTGRES_*  — provided by Vercel Postgres / Neon integration

import NextAuth, { type DefaultSession, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db, isDbConfigured } from "@/lib/db";

declare module "next-auth" {
  interface Session extends DefaultSession {
    tenantId?: string;
    role?: "OWNER" | "MEMBER" | "READONLY";
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

export const authConfig: NextAuthConfig = {
  // No PrismaAdapter for the Credentials path — we manage User / Tenant
  // rows ourselves in the signup action and look them up in `authorize`.
  // (Adapters in Auth.js v5 are wired to OAuth + Email providers; mixing
  // adapter sessions with Credentials is unsupported.)
  session: { strategy: "jwt" },
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!isDbConfigured) return null;
        const email = String(credentials?.email ?? "").toLowerCase().trim();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const user = await db().user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            tenantId: true,
            passwordHash: true,
          },
        });
        if (!user || !user.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        // Bump last-login timestamp; ignore failure (auth must succeed).
        void db()
          .user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
          .catch(() => {});

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? user.email.split("@")[0],
          tenantId: user.tenantId ?? undefined,
          role: user.role,
        };
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    // Pull tenantId + role out of `user` (returned by authorize) into the
    // JWT once at sign-in. On subsequent requests Auth.js calls jwt() with
    // only `token` — we trust whatever's already there.
    // The JWT carries id+tenantId+role across requests so the session
    // callback can attach them without a DB hit.
    async jwt({ token, user }) {
      if (user) {
        const u = user as {
          id: string;
          tenantId?: string;
          role?: "OWNER" | "MEMBER" | "READONLY";
        };
        token.sub = u.id;
        (token as Record<string, unknown>).tenantId = u.tenantId;
        (token as Record<string, unknown>).role = u.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      const t = token as Record<string, unknown>;
      if (typeof t.tenantId === "string") session.tenantId = t.tenantId;
      if (typeof t.role === "string")
        session.role = t.role as "OWNER" | "MEMBER" | "READONLY";
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

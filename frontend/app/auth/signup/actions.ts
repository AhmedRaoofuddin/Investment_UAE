"use server";

// Server action for sign-up — split from the page so the page itself
// can be a client component (to call useLocale for translated strings).
//
// Self-service sign-up is disabled for the pilot. Flip SIGNUP_ENABLED to
// re-open public registration. The full create-account flow (bcrypt →
// tenant/user transaction → signIn) stays below so re-enabling is a
// one-line change, but while the flag is off the action short-circuits
// to the coming-soon page before touching the DB or creating any rows.
// Defense in depth: even if a stale form is cached or a bot POSTs here
// directly, nothing is created.

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { signIn } from "@/lib/auth";
import { db, isDbConfigured } from "@/lib/db";
import { audit } from "@/lib/audit";

const SIGNUP_ENABLED = false;

export async function doSignUp(formData: FormData) {
  if (!SIGNUP_ENABLED) {
    redirect("/auth/signup");
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password || password.length < 8) {
    redirect("/auth/signup?error=invalid");
  }
  if (!isDbConfigured) {
    redirect("/auth/signup?error=server");
  }

  const existing = await db().user.findUnique({ where: { email } });
  if (existing) redirect("/auth/signup?error=exists");

  const passwordHash = await bcrypt.hash(password, 12);

  // Tenant + user in one transaction so a half-created row never lingers.
  const user = await db().$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: name || email.split("@")[0],
        tier: "PILOT",
      },
    });
    return tx.user.create({
      data: {
        email,
        name: name || email.split("@")[0],
        passwordHash,
        emailVerified: new Date(),
        role: "OWNER",
        tenantId: tenant.id,
      },
    });
  });

  audit({
    action: "tenant.created",
    tenantId: user.tenantId,
    userId: user.id,
    subject: user.tenantId,
    meta: { via: "signup" },
  });

  // Now sign them in. Credentials.authorize will look up the user and
  // verify the password we just stored.
  await signIn("credentials", { email, password, redirectTo: "/workspace" });
}

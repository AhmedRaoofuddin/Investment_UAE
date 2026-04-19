"use server";

// Server action for sign-in — split from the page so the page itself
// can be a client component (to call useLocale for translated strings).

import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";

export async function doSignIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "/workspace");
  if (!email || !password) {
    redirect(`/auth/signin?error=missing&callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  // signIn throws a NEXT_REDIRECT on success; on credential failure it
  // throws an AuthError we catch and turn into a query-param round-trip.
  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: callbackUrl,
    });
  } catch (err: unknown) {
    // NEXT_REDIRECT must propagate.
    const e = err as { message?: string; digest?: string };
    if (e?.digest?.startsWith("NEXT_REDIRECT")) throw err;
    redirect(
      `/auth/signin?error=invalid&callbackUrl=${encodeURIComponent(callbackUrl)}`,
    );
  }
}

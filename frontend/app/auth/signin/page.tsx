// Sign-in page — email + password.
//
// Server action calls Auth.js's `signIn("credentials", {...})`. On success
// the user lands on the callbackUrl (default /workspace); on failure we
// surface the error via a query param so the form can re-render with it.

import { SignInForm } from "./SignInForm";

interface PageProps {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}

export default async function SignInPage({ searchParams }: PageProps) {
  const { error, callbackUrl } = await searchParams;
  return <SignInForm error={error} callbackUrl={callbackUrl} />;
}

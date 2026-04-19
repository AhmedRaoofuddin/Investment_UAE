// Sign-up page — name + email + password.
//
// Server action:
//   1. Validates input.
//   2. Rejects duplicate email.
//   3. Creates a Tenant + User in a single transaction with bcrypt(password).
//   4. Calls signIn("credentials") which redeems the just-created creds and
//      sets the session cookie. User lands on /workspace.

import { SignUpForm } from "./SignUpForm";

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function SignUpPage({ searchParams }: PageProps) {
  const { error } = await searchParams;
  return <SignUpForm error={error} />;
}

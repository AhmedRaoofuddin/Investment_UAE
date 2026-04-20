// Sign-up page — currently invitation-only (self-service disabled for the pilot).
//
// The UI renders a coming-soon card. The server action in ./actions.ts
// short-circuits any direct POSTs so the DB is never touched while the
// SIGNUP_ENABLED flag is off.

import { SignUpForm } from "./SignUpForm";

export default function SignUpPage() {
  return <SignUpForm />;
}

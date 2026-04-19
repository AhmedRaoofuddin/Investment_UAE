// Header CTA used by the marketing layout.
//
// When unauthenticated, surfaces "Sign in" → /auth/signin.
// When authenticated, surfaces "Workspace" → /workspace.
// Server component so we don't ship the auth check to the client bundle.

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getSessionOrNull } from "@/lib/security/session";

export async function WorkspaceLink() {
  const session = await getSessionOrNull();
  const href = session ? "/workspace" : "/auth/signin";
  const label = session ? "Workspace" : "Sign in";
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-700 hover:text-gold-600 transition-colors"
    >
      {label}
      <ArrowRight className="w-3.5 h-3.5" />
    </Link>
  );
}

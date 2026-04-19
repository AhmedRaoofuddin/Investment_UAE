// Workspace layout — auth gate + persistent sub-nav.
//
// Auth check + server-action signOut stay on the server. The sub-nav
// UI lives in `WorkspaceNav` (client) so it can call useLocale() for
// EN/AR translations. The signOut action is passed down as a prop.

import { redirect } from "next/navigation";
import { getSessionOrNull } from "@/lib/security/session";
import { signOut } from "@/lib/auth";
import { WorkspaceNav } from "./WorkspaceNav";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionOrNull();
  if (!session) redirect("/auth/signin?callbackUrl=/workspace");

  async function doSignOut() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <div className="bg-sand-50 min-h-screen">
      <WorkspaceNav signOutAction={doSignOut} />
      {children}
    </div>
  );
}

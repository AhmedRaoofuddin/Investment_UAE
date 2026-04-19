// Analytics dashboard for the investor workspace.
//
// Server shell renders nothing itself — the client `DashboardView`
// pulls `/api/workspace/dashboard` with SWR every 60s so KPIs stay
// fresh without a page reload. Auth is enforced at the route level.

import { requireSession } from "@/lib/security/session";
import { DashboardView } from "./DashboardView";

export const dynamic = "force-dynamic";

export default async function WorkspaceDashboard() {
  await requireSession();
  return <DashboardView />;
}

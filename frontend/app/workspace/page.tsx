// Workspace landing — the immersive Pulse view.
//
// Full-bleed satellite map with floating glass panels for stats, the live
// signal stream, the latest inbox alerts, and a sector pulse. Polled by
// the WorkspacePulse client every 30s.

import { requireSession } from "@/lib/security/session";
import { WorkspacePulse } from "@/components/workspace/WorkspacePulse";

export const dynamic = "force-dynamic";

export default async function WorkspacePulsePage() {
  // Ensure auth before render so the layout doesn't have to do it again.
  await requireSession();
  return <WorkspacePulse />;
}

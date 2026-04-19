"use client";

// Client button that:
// 1. POSTs to /api/workspace/nango/session to mint a Connect session token.
// 2. Opens Nango's hosted Connect UI with that token.
// 3. On success, reloads the page so the catalogue reflects the new
//    connection.

import { useState } from "react";
import Nango from "@nangohq/frontend";

interface Props {
  integrationId: string;
  label: string;
}

export function NangoConnectButton({ integrationId, label }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConnect() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/workspace/nango/session", { method: "POST" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.error ?? `session-failed-${r.status}`);
        setBusy(false);
        return;
      }
      const { token } = (await r.json()) as { token: string };
      const nango = new Nango({ connectSessionToken: token });
      const result = await nango.openConnectUI({
        sessionToken: token,
        onEvent: (event) => {
          if (event.type === "connect") {
            // Refresh to pull the new connection into the catalogue.
            window.location.reload();
          }
          if (event.type === "close") {
            setBusy(false);
          }
        },
      });
      // Some Nango SDK versions resolve when the user finishes; others
      // rely on the onEvent callback above. Either way we no-op here.
      void result;
    } catch (err) {
      setError((err as Error).message ?? "unknown");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={onConnect}
        disabled={busy}
        className="inline-flex items-center gap-1.5 px-3 h-9 rounded-[3px] bg-navy-800 text-white text-sm font-medium hover:bg-navy-700 disabled:opacity-60"
      >
        {busy ? "Opening..." : `Connect ${label}`}
      </button>
      {error && (
        <span className="ml-2 text-xs text-red-700">{error}</span>
      )}
    </>
  );
}

"use client";

// Themed confirmation modal — replaces the platform-native `window.confirm`
// everywhere in the app. Matches the Ministry visual language (navy /
// gold / sand palette, serif heading, rounded-3 borders) so destructive
// actions feel like a Ministry prompt instead of a browser pop-up.
//
// Accessibility:
//   - Focus is trapped inside the dialog while open.
//   - ESC closes (same semantics as the native confirm's Cancel).
//   - Backdrop click closes.
//   - aria-modal + role="dialog" + aria-labelledby wire up correctly
//     for screen readers.
//
// Usage:
//   const [open, setOpen] = useState(false);
//   <button onClick={() => setOpen(true)}>Delete…</button>
//   <ConfirmDialog
//     open={open}
//     title="Delete this item?"
//     body="This action cannot be undone."
//     tone="danger"
//     confirmLabel="Delete"
//     onConfirm={async () => { await doDelete(); setOpen(false); }}
//     onClose={() => setOpen(false)}
//   />

import { useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" paints the confirm button + icon chip red for destructive ops. */
  tone?: "default" | "danger";
  /** Shown while the confirm promise resolves (button disabled + label swap). */
  pending?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  pending = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Focus the confirm button on open + lock scroll + ESC to close.
  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, pending, onClose]);

  if (!open) return null;

  const isDanger = tone === "danger";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="relative bg-white w-full max-w-md rounded-md shadow-2xl">
        <button
          type="button"
          onClick={() => !pending && onClose()}
          aria-label={cancelLabel}
          disabled={pending}
          className="absolute top-3 end-3 p-1.5 rounded-full hover:bg-sand-100 text-ink-500 disabled:opacity-40"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 md:p-7">
          <div className="flex items-start gap-4 mb-4">
            <div
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                isDanger
                  ? "bg-rose-50 text-rose-700"
                  : "bg-gold-50 text-gold-700",
              )}
              aria-hidden
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h2
                id="confirm-dialog-title"
                className="headline-serif text-navy-900 text-xl leading-tight"
              >
                {title}
              </h2>
              {body && (
                <p className="mt-2 text-sm text-ink-500 leading-relaxed">
                  {body}
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => !pending && onClose()}
              disabled={pending}
              className="px-3 h-9 rounded-[3px] border border-line bg-white text-navy-700 text-xs font-medium hover:border-navy-300 disabled:opacity-40"
            >
              {cancelLabel}
            </button>
            <button
              ref={confirmRef}
              type="button"
              onClick={() => onConfirm()}
              disabled={pending}
              className={cn(
                "px-4 h-9 rounded-[3px] text-xs font-semibold transition-colors disabled:opacity-60",
                isDanger
                  ? "bg-rose-600 text-white hover:bg-rose-500"
                  : "bg-navy-800 text-white hover:bg-navy-700",
              )}
            >
              {pending ? "…" : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

// Client-side workspace sub-nav. Receives the server action as a prop so
// the sign-out flow stays server-executed, but the UI can call useLocale()
// for EN/AR translations + RTL layout.
//
// Mobile: hamburger + right-side drawer (people weren't discovering the
// horizontal scroll on phones). Desktop: full tab row as before.

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Activity, BarChart3, Bell, Bookmark, LayoutDashboard, Plug, LogOut, Menu, X } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/workspace", tKey: "workspace.nav.pulse", Icon: Activity },
  { href: "/workspace/overview", tKey: "workspace.nav.overview", Icon: LayoutDashboard },
  { href: "/workspace/dashboard", tKey: "workspace.nav.dashboard", Icon: BarChart3 },
  { href: "/workspace/connections", tKey: "workspace.nav.connections", Icon: Plug },
  { href: "/workspace/watchlist", tKey: "workspace.nav.watchlist", Icon: Bookmark },
  { href: "/workspace/notifications", tKey: "workspace.nav.notifications", Icon: Bell },
] as const;

export function WorkspaceNav({ signOutAction }: { signOutAction: () => Promise<void> }) {
  const { t } = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close drawer whenever the route changes
  useEffect(() => { setOpen(false); }, [pathname]);

  // Lock body scroll while drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const isActive = (href: string) =>
    href === "/workspace" ? pathname === "/workspace" : pathname.startsWith(href);

  const current = NAV.find((n) => isActive(n.href)) ?? NAV[0];

  return (
    <div className="bg-white border-b border-line">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-10 h-12 md:h-14 flex items-center gap-1">
        {/* Mobile trigger: hamburger + current section label */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open workspace menu"
          aria-expanded={open}
          className="md:hidden inline-flex items-center gap-2 px-2 h-full text-[13px] font-medium text-navy-800"
        >
          <Menu className="w-4 h-4" />
          <current.Icon className="w-3.5 h-3.5 text-gold-600" />
          <span className="truncate max-w-[40vw]">{t(current.tKey)}</span>
        </button>

        {/* Desktop tab row */}
        <div className="hidden md:flex items-center gap-1 flex-1 overflow-x-auto scrollbar-hide">
          {NAV.map((n) => {
            const active = isActive(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "inline-flex items-center gap-2 px-4 h-full text-[13px] font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
                  active
                    ? "text-navy-900 border-gold-500"
                    : "text-ink-500 border-transparent hover:text-navy-900",
                )}
              >
                <n.Icon className="w-3.5 h-3.5" />
                {t(n.tKey)}
              </Link>
            );
          })}
        </div>

        <form action={signOutAction} className="ms-auto shrink-0">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-3 h-full text-[12px] md:text-[13px] font-medium text-ink-500 hover:text-navy-900 whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5 rtl:-scale-x-100" />
            <span className="hidden sm:inline">{t("workspace.nav.signOut")}</span>
          </button>
        </form>
      </div>

      {/* Mobile drawer — z-[1000] sits above Leaflet's built-in 800 */}
      {open && (
        <div className="fixed inset-0 z-[1000] md:hidden">
          <div
            className="absolute inset-0 bg-navy-900/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-0 right-0 w-[85%] max-w-sm h-full bg-white shadow-2xl overflow-y-auto animate-slide-in-right">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <span className="text-[11px] uppercase tracking-[0.22em] text-gold-600 font-semibold">
                {t("workspace.nav.pulse")}
              </span>
              <button
                onClick={() => setOpen(false)}
                className="p-2 rounded-full hover:bg-sand-200 text-navy-700"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="py-2">
              {NAV.map((n) => {
                const active = isActive(n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-5 py-3.5 text-[15px] font-medium transition-colors",
                      active
                        ? "text-navy-900 bg-gold-50 border-l-2 border-gold-500"
                        : "text-navy-800 hover:bg-sand-50",
                    )}
                  >
                    <n.Icon className="w-4 h-4" />
                    {t(n.tKey)}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}

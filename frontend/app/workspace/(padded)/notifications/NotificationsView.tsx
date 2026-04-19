"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, Clock, Info } from "lucide-react";
import { Eyebrow, SerifHeading, Card, CardBody, Badge } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Pagination } from "@/components/ui/Pagination";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const PER_PAGE = 10;

interface NotifItem {
  id: string;
  severity: "INFO" | "ALERT" | "CRITICAL";
  status: "UNREAD" | "READ" | "ARCHIVED";
  title: string;
  body: string;
  createdAt: Date;
}

function timeAgo(d: Date, t: (k: string) => string): string {
  const ms = Date.now() - d.getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return t("workspace.time.justNow");
  if (min < 60) return t("workspace.time.minutes").replace("{n}", String(min));
  const hr = Math.floor(min / 60);
  if (hr < 24) return t("workspace.time.hours").replace("{n}", String(hr));
  return t("workspace.time.days").replace("{n}", String(Math.floor(hr / 24)));
}

export function NotificationsView({
  items,
  counts,
  view,
  info,
  throttleNextAt,
}: {
  items: NotifItem[];
  counts: { inbox: number; archived: number; unread: number };
  view: "inbox" | "archived";
  info?: string | null;
  throttleNextAt?: string | null;
}) {
  const { t } = useLocale();
  const [page, setPage] = useState(1);

  // Reset to page 1 when the tab (inbox / archived) changes — otherwise
  // a user on page 3 of the inbox lands on an empty page 3 of the archive.
  useEffect(() => { setPage(1); }, [view]);

  const totalPages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PER_PAGE;
  const pageEnd = pageStart + PER_PAGE;
  const paginated = useMemo(
    () => items.slice(pageStart, pageEnd),
    [items, pageStart, pageEnd],
  );

  const severityLabel = (s: NotifItem["severity"]) => {
    if (s === "CRITICAL") return t("workspace.notifications.severity.critical");
    if (s === "ALERT") return t("workspace.notifications.severity.alert");
    return t("workspace.notifications.severity.info");
  };

  return (
    <>
      <div className="mb-6">
        <Eyebrow>{t("workspace.nav.notifications")}</Eyebrow>
        <SerifHeading level={1} className="mt-2">
          {t("workspace.notifications.title")}
        </SerifHeading>
        <p className="mt-2 text-ink-500 max-w-2xl">
          {t("workspace.notifications.subtitle")}
        </p>
      </div>

      {info && (
        <InfoBanner info={info} throttleNextAt={throttleNextAt ?? null} />
      )}

      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-white border border-line rounded-[3px] p-1">
          {[
            { key: "inbox" as const, label: t("workspace.notifications.filter.all"), count: counts.inbox },
            { key: "archived" as const, label: t("workspace.notifications.archive"), count: counts.archived },
          ].map((tab) => {
            const active = view === tab.key;
            return (
              <Link
                key={tab.key}
                href={tab.key === "inbox" ? "/workspace/notifications" : "/workspace/notifications?view=archived"}
                className={cn(
                  "inline-flex items-center gap-2 px-3 h-8 rounded-[2px] text-xs font-medium transition-colors",
                  active
                    ? "bg-navy-800 text-white"
                    : "text-ink-500 hover:text-navy-800",
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px]",
                    active ? "bg-white/20 text-white" : "bg-sand-100 text-ink-500",
                  )}
                >
                  {tab.count}
                </span>
              </Link>
            );
          })}
        </div>
        {counts.unread > 0 && view === "inbox" && (
          <span className="text-xs text-gold-700">
            {t("workspace.notifications.unreadCount").replace("{n}", String(counts.unread))}
          </span>
        )}
        {view === "inbox" && counts.inbox > 0 && (
          <div className="ms-auto flex items-center gap-2">
            <BulkAction
              scope="ai-summary"
              label={t(
                "workspace.notifications.bulk.clearBriefings",
                "Archive AI briefings",
              )}
              confirmKey="workspace.notifications.bulk.confirmBriefings"
              confirmFallback="Archive every AI-generated watchlist briefing?"
            />
            <BulkAction
              scope="read"
              label={t("workspace.notifications.bulk.clearRead", "Archive read")}
              confirmKey="workspace.notifications.bulk.confirmRead"
              confirmFallback="Archive every notification you've marked as read?"
              variant="ghost"
            />
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <Card>
          <CardBody className="p-8 text-center text-sm text-ink-500">
            {t("workspace.notifications.empty")}
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {paginated.map((n) => {
              const tone =
                n.severity === "CRITICAL"
                  ? "danger"
                  : n.severity === "ALERT"
                    ? "warning"
                    : "navy";
              return (
                <Card key={n.id}>
                  <CardBody className="p-4 md:p-5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Badge tone={tone}>{severityLabel(n.severity)}</Badge>
                      </div>
                      <span className="text-xs text-ink-500">
                        {timeAgo(n.createdAt, t)}
                      </span>
                    </div>
                    <h3 className="mt-3 font-medium text-navy-800">{n.title}</h3>
                    <p className="mt-1 text-sm text-ink-500 leading-relaxed whitespace-pre-line">
                      {n.body}
                    </p>
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      {n.status === "UNREAD" && (
                        <NotifAction id={n.id} action="read" label={t("workspace.notifications.markRead")} />
                      )}
                      {n.status === "READ" && (
                        <NotifAction id={n.id} action="unread" label={t("workspace.notifications.markUnread")} />
                      )}
                      {n.status !== "ARCHIVED" && (
                        <NotifAction id={n.id} action="archive" label={t("workspace.notifications.archive")} />
                      )}
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>

          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageStart={pageStart}
              pageEnd={Math.min(pageEnd, items.length)}
              totalItems={items.length}
              itemNounKey="common.pagination.noun.notifications"
              itemNounFallback="notifications"
              onChange={(p) => {
                setPage(p);
                if (typeof window !== "undefined") {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
            />
          )}
        </>
      )}
    </>
  );
}

function NotifAction({ id, action, label }: { id: string; action: string; label: string }) {
  return (
    <form action={`/api/workspace/notifications/${id}`} method="post">
      <input type="hidden" name="action" value={action} />
      <button
        type="submit"
        className="text-xs px-2.5 h-7 rounded-[3px] border border-line bg-white text-ink-500 hover:text-navy-800 hover:border-navy-300"
      >
        {label}
      </button>
    </form>
  );
}

function BulkAction({
  scope,
  label,
  confirmKey,
  confirmFallback,
  variant = "solid",
}: {
  scope: "ai-summary" | "read" | "all";
  label: string;
  confirmKey: string;
  confirmFallback: string;
  variant?: "solid" | "ghost";
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 h-8 rounded-[3px] text-xs font-medium transition-colors whitespace-nowrap",
          variant === "solid"
            ? "bg-gold-500 text-navy-900 hover:bg-gold-400"
            : "border border-line bg-white text-ink-500 hover:text-navy-800 hover:border-navy-300",
        )}
      >
        {label}
      </button>

      {/* Hidden form — the modal's confirm button dispatches it. */}
      <form
        ref={formRef}
        action="/api/workspace/notifications/bulk"
        method="post"
        className="hidden"
      >
        <input type="hidden" name="scope" value={scope} />
      </form>

      <ConfirmDialog
        open={open}
        title={label}
        body={t(confirmKey, confirmFallback)}
        confirmLabel={t("workspace.notifications.bulk.confirmBtn", "Archive")}
        cancelLabel={t("common.cancel", "Cancel")}
        tone="default"
        pending={pending}
        onClose={() => setOpen(false)}
        onConfirm={() => {
          setPending(true);
          formRef.current?.submit();
        }}
      />
    </>
  );
}

// ── Contextual info banner ──────────────────────────────────────────
//
// Shown when the user lands on /workspace/notifications with an ?info=…
// query (e.g. after a throttled briefing attempt, or a successful bulk
// archive). Uses a live countdown for the throttle case so the user
// knows when they can try again instead of silently failing a second
// click.

function InfoBanner({
  info,
  throttleNextAt,
}: {
  info: string;
  throttleNextAt: string | null;
}) {
  const { t } = useLocale();

  // Archive count banner: `?info=archived-12`
  if (info.startsWith("archived-")) {
    const count = Number(info.slice("archived-".length)) || 0;
    return (
      <BannerShell tone="success" Icon={Check}>
        {t(
          "workspace.notifications.info.archived",
          "Archived {n} notification(s).",
        ).replace("{n}", String(count))}
      </BannerShell>
    );
  }

  if (info === "throttled") {
    return <ThrottleBanner nextAt={throttleNextAt} />;
  }

  // Generic fallback for unknown info codes.
  return (
    <BannerShell tone="info" Icon={Info}>
      {info}
    </BannerShell>
  );
}

function ThrottleBanner({ nextAt }: { nextAt: string | null }) {
  const { t } = useLocale();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const readyAt = nextAt ? new Date(nextAt).getTime() : 0;
  const secsLeft = Math.max(0, Math.floor((readyAt - now) / 1000));
  const ready = secsLeft === 0;
  const mins = Math.floor(secsLeft / 60);
  const secs = secsLeft % 60;

  return (
    <BannerShell tone={ready ? "success" : "warning"} Icon={Clock}>
      {ready ? (
        <span>
          {t(
            "workspace.notifications.info.throttleReady",
            "You can run a new briefing now.",
          )}
        </span>
      ) : (
        <span>
          {t(
            "workspace.notifications.info.throttled",
            "Last briefing was run within the 5-minute cooldown window.",
          )}{" "}
          <span className="font-mono text-navy-900">
            {t("workspace.notifications.info.tryAgainIn", "Try again in")}{" "}
            {mins > 0 ? `${mins}m ` : ""}
            {String(secs).padStart(2, "0")}s
          </span>
        </span>
      )}
    </BannerShell>
  );
}

function BannerShell({
  tone,
  Icon,
  children,
}: {
  tone: "info" | "success" | "warning";
  Icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  const styles = {
    info: "border-navy-200 bg-navy-50 text-navy-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
  }[tone];
  const iconStyles = {
    info: "text-navy-600",
    success: "text-emerald-600",
    warning: "text-amber-600",
  }[tone];
  return (
    <div
      className={cn(
        "mb-4 p-3 md:p-4 rounded-[4px] border flex items-start gap-3",
        styles,
      )}
    >
      <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", iconStyles)} />
      <div className="text-sm leading-relaxed min-w-0 flex-1">{children}</div>
    </div>
  );
}

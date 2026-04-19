"use client";

// Workspace overview — composed of four parts:
//   1. KPI tiles (4) — the existing counts, clickable to the matching page
//   2. Recent alerts — 5 most recent notifications, linking to the inbox
//   3. Your watchlist — a summary of active watched items
//   4. Connected systems — a condensed view of active connectors
//
// All four read bilingual strings from the dictionary; every list
// collapses to a single column on mobile and the 2-column sections
// rearrange vertically under md. RTL-aware chevrons throughout.

import type { ComponentType } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Bell,
  Bookmark,
  ChevronRight,
  ExternalLink,
  Plug,
  Sparkles,
  Zap,
} from "lucide-react";
import { Card, CardBody, Eyebrow, SerifHeading, Badge } from "@/components/ui/primitives";
import { RefreshPipelineButton } from "@/components/workspace/RefreshPipelineButton";
import { useLocale } from "@/lib/i18n/LocaleProvider";

interface RecentAlert {
  id: string;
  title: string;
  body: string;
  severity: string;
  status: string;
  createdAt: string;
}

interface WatchlistItem {
  id: string;
  kind: string;
  value: string;
  label: string;
}

interface ActiveConnector {
  id: string;
  provider: string;
  label: string | null;
}

export function OverviewView({
  username,
  counts,
  recentAlerts,
  watchlistItems,
  activeConnectors,
  dbConfigured,
}: {
  username: string;
  counts: {
    connections: number;
    watchlist: number;
    unread: number;
    aiCalls: number;
  };
  recentAlerts: RecentAlert[];
  watchlistItems: WatchlistItem[];
  activeConnectors: ActiveConnector[];
  dbConfigured: boolean;
}) {
  const { t } = useLocale();

  const tiles = [
    {
      href: "/workspace/connections",
      Icon: Plug,
      label: t("workspace.overview.stat.connectionsCount"),
      value: String(counts.connections),
      hint:
        activeConnectors.length > 0
          ? activeConnectors
              .slice(0, 3)
              .map((c) => prettyProvider(c.provider))
              .join(", ")
          : t("workspace.overview.tile.connectionsEmpty", "No active connectors"),
    },
    {
      href: "/workspace/watchlist",
      Icon: Bookmark,
      label: t("workspace.overview.stat.watchlistCount"),
      value: String(counts.watchlist),
      hint:
        t("workspace.watchlist.kind.company") +
        ", " +
        t("workspace.watchlist.kind.sector") +
        ", " +
        t("workspace.watchlist.kind.region"),
    },
    {
      href: "/workspace/notifications",
      Icon: Bell,
      label: t("workspace.overview.stat.unreadCount"),
      value: String(counts.unread),
      hint: t("workspace.nav.notifications"),
    },
    {
      href: "/workspace/notifications",
      Icon: Sparkles,
      label: t("workspace.overview.tile.aiLabel", "AI decisions"),
      value: String(counts.aiCalls),
      hint: t("workspace.overview.tile.aiHint", "Audited · PDPL-compliant"),
    },
  ];

  return (
    <>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="mb-6 md:mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <Eyebrow>{t("workspace.nav.overview")}</Eyebrow>
          <SerifHeading level={1} className="mt-2 break-words">
            {t("workspace.overview.title").replace("{name}", username)}
          </SerifHeading>
          <p className="mt-2 text-ink-500 text-sm md:text-base max-w-2xl">
            {t("workspace.overview.subtitle")}
          </p>
        </div>
        <RefreshPipelineButton size="md" />
      </div>

      {/* ── KPI tiles ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {tiles.map((tile) => (
          <Link key={tile.label} href={tile.href} className="group">
            <Card className="h-full group-hover:border-navy-200 transition-colors">
              <CardBody className="p-4 md:p-6">
                <div className="flex items-center justify-between text-ink-500">
                  <tile.Icon className="w-5 h-5 text-gold-600" />
                  <ChevronRight className="w-4 h-4 rtl:-scale-x-100 opacity-60 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-3 md:mt-4 headline-serif text-3xl md:text-4xl text-navy-800 leading-none">
                  {tile.value}
                </div>
                <div className="mt-2 md:mt-3 text-[13px] md:text-sm font-medium text-navy-800">
                  {tile.label}
                </div>
                <div className="mt-1 text-[11px] md:text-xs text-ink-500 line-clamp-1">
                  {tile.hint}
                </div>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>

      {/* ── Two-column body: alerts (wider) + side rail ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mt-6 md:mt-8">
        {/* Recent alerts */}
        <section className="lg:col-span-2">
          <SectionHeader
            icon={Bell}
            title={t("workspace.overview.alerts.title", "Recent alerts")}
            hint={t(
              "workspace.overview.alerts.hint",
              "Latest signals routed to your inbox.",
            )}
            linkHref="/workspace/notifications"
            linkLabel={t("workspace.overview.alerts.viewAll", "View all")}
          />
          {recentAlerts.length === 0 ? (
            <EmptyCard
              message={t(
                "workspace.overview.alerts.empty",
                "No recent alerts. Add items to your watchlist to start receiving matches.",
              )}
            />
          ) : (
            <div className="space-y-3">
              {recentAlerts.map((a) => (
                <AlertCard key={a.id} alert={a} />
              ))}
            </div>
          )}
        </section>

        {/* Side rail: watchlist + connectors */}
        <aside className="space-y-4 md:space-y-6">
          <section>
            <SectionHeader
              icon={Bookmark}
              title={t("workspace.overview.watchlist.title", "Your watchlist")}
              linkHref="/workspace/watchlist"
              linkLabel={t("workspace.overview.watchlist.manage", "Manage")}
            />
            {watchlistItems.length === 0 ? (
              <EmptyCard
                message={t(
                  "workspace.overview.watchlist.empty",
                  "Watchlist is empty. Flag companies, sectors, or keywords to personalise the feed.",
                )}
              />
            ) : (
              <Card>
                <CardBody className="p-3 md:p-4">
                  <ul className="divide-y divide-line">
                    {watchlistItems.slice(0, 6).map((w) => (
                      <li
                        key={w.id}
                        className="py-2 flex items-start gap-3 first:pt-0 last:pb-0"
                      >
                        <Badge tone="navy" className="mt-0.5 shrink-0">
                          {t(`workspace.watchlist.kind.${w.kind.toLowerCase()}`, w.kind)}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-navy-800 truncate">{w.label}</div>
                          <div className="text-[11px] text-ink-500 truncate">{w.value}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {watchlistItems.length > 6 && (
                    <div className="mt-3 pt-3 border-t border-line text-[11px] text-ink-500">
                      +{watchlistItems.length - 6}{" "}
                      {t("workspace.overview.watchlist.more", "more")}
                    </div>
                  )}
                </CardBody>
              </Card>
            )}
          </section>

          <section>
            <SectionHeader
              icon={Plug}
              title={t("workspace.overview.connectors.title", "Connected systems")}
              linkHref="/workspace/connections"
              linkLabel={t("workspace.overview.connectors.add", "Add")}
            />
            {activeConnectors.length === 0 ? (
              <EmptyCard
                message={t(
                  "workspace.overview.connectors.empty",
                  "No active connectors. Route signals to Slack, Teams, Power BI, and more.",
                )}
              />
            ) : (
              <Card>
                <CardBody className="p-3 md:p-4">
                  <ul className="divide-y divide-line">
                    {activeConnectors.map((c) => (
                      <li
                        key={c.id}
                        className="py-2 flex items-center gap-3 first:pt-0 last:pb-0"
                      >
                        <span
                          className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-navy-800 truncate">
                            {prettyProvider(c.provider)}
                          </div>
                          {c.label && (
                            <div className="text-[11px] text-ink-500 truncate">
                              {c.label}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            )}
          </section>
        </aside>
      </div>

      {/* ── Quick actions strip ─────────────────────────────────────── */}
      <section className="mt-6 md:mt-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          <QuickAction
            href="/workspace"
            Icon={Zap}
            title={t("workspace.overview.quick.pulse", "Open live Pulse")}
            hint={t(
              "workspace.overview.quick.pulseHint",
              "Map view of today's matched signals.",
            )}
          />
          <QuickAction
            href="/workspace/dashboard"
            Icon={Sparkles}
            title={t("workspace.overview.quick.dashboard", "Open analytics dashboard")}
            hint={t(
              "workspace.overview.quick.dashboardHint",
              "KPIs, trends, and rankings.",
            )}
          />
          <QuickAction
            href="/workspace/connections"
            Icon={Plug}
            title={t("workspace.overview.quick.connect", "Connect a destination")}
            hint={t(
              "workspace.overview.quick.connectHint",
              "Stream signals to Power BI, Slack, n8n, and more.",
            )}
          />
        </div>
      </section>

      {!dbConfigured && (
        <div className="mt-6 md:mt-8 p-4 md:p-5 rounded-[4px] border border-amber-300 bg-amber-50 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              {t(
                "workspace.overview.noDb",
                "Database not configured. Provision Vercel Postgres and set POSTGRES_PRISMA_URL + POSTGRES_URL_NON_POOLING, then run prisma migrate deploy.",
              )}
            </span>
          </div>
        </div>
      )}
    </>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  hint,
  linkHref,
  linkLabel,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
  linkHref: string;
  linkLabel: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="w-4 h-4 text-gold-600 shrink-0" />
        <h2 className="text-[11px] uppercase tracking-[0.24em] text-gold-600 font-semibold">
          {title}
        </h2>
        {hint && (
          <span className="hidden md:inline text-xs text-ink-500">· {hint}</span>
        )}
      </div>
      <Link
        href={linkHref}
        className="text-xs text-navy-700 hover:text-navy-900 inline-flex items-center gap-1"
      >
        {linkLabel}
        <ChevronRight className="w-3.5 h-3.5 rtl:-scale-x-100" />
      </Link>
    </div>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <Card>
      <CardBody className="p-5 text-center text-xs text-ink-500">{message}</CardBody>
    </Card>
  );
}

function AlertCard({ alert }: { alert: RecentAlert }) {
  const { t } = useLocale();
  const toneBySeverity: Record<string, "default" | "warning" | "danger"> = {
    INFO: "default",
    ALERT: "warning",
    CRITICAL: "danger",
  };
  const tone = toneBySeverity[alert.severity] ?? "default";
  const isUnread = alert.status === "UNREAD";
  const preview = alert.body.split("\n")[0]?.slice(0, 180) ?? "";
  return (
    <Card className={isUnread ? "bg-gold-50/40 border-gold-100" : undefined}>
      <CardBody className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone={tone}>{alert.severity.toLowerCase()}</Badge>
            {isUnread && (
              <span className="text-[10px] uppercase tracking-[0.2em] text-gold-700 font-semibold">
                {t("workspace.overview.alerts.unread", "unread")}
              </span>
            )}
          </div>
          <time className="text-[11px] text-ink-400 shrink-0">
            {formatRelative(alert.createdAt, t)}
          </time>
        </div>
        <h3 className="font-medium text-navy-800 text-sm md:text-[15px] leading-snug">
          {alert.title}
        </h3>
        {preview && (
          <p className="mt-1 text-xs md:text-sm text-ink-500 line-clamp-2 leading-relaxed">
            {preview}
          </p>
        )}
      </CardBody>
    </Card>
  );
}

function QuickAction({
  href,
  Icon,
  title,
  hint,
}: {
  href: string;
  Icon: ComponentType<{ className?: string }>;
  title: string;
  hint: string;
}) {
  return (
    <Link href={href} className="group">
      <Card className="h-full group-hover:border-navy-200 transition-colors">
        <CardBody className="p-4 md:p-5 flex items-start gap-3">
          <div className="w-9 h-9 rounded-[3px] bg-gold-50 text-gold-700 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-navy-800 leading-tight flex items-center gap-1.5">
              {title}
              <ExternalLink className="w-3 h-3 text-ink-400 rtl:-scale-x-100 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="mt-0.5 text-[11px] md:text-xs text-ink-500 leading-snug">
              {hint}
            </div>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────

function prettyProvider(id: string): string {
  // Map connector ids to display names — matches what the catalogue shows
  // on the Connections page. Kept local to avoid importing the full
  // catalogue (it pulls crypto-heavy secret-seal code we don't need here).
  const MAP: Record<string, string> = {
    "power-bi": "Power BI",
    "tableau-webhook": "Tableau",
    "google-sheets-webhook": "Google Sheets",
    "slack-webhook": "Slack",
    "teams-webhook": "Microsoft Teams",
    "email-resend": "Email",
    "whatsapp-meta": "WhatsApp",
    "google-chat": "Google Chat",
    "webhook-generic": "Custom Webhook",
    "power-automate": "Power Automate",
    zapier: "Zapier",
    make: "Make",
    n8n: "n8n",
    "azure-logic-apps": "Azure Logic Apps",
    "azure-devops": "Azure DevOps",
    airtable: "Airtable",
    "notion-api": "Notion",
    "mcp-endpoint": "MCP Server",
  };
  return MAP[id] ?? id;
}

function formatRelative(iso: string, t: (k: string, f?: string) => string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const deltaMin = Math.max(0, Math.floor((Date.now() - then) / 60_000));
  if (deltaMin < 1) return t("workspace.time.justNow", "just now");
  if (deltaMin < 60)
    return t("workspace.time.minutes", "{n}m ago").replace("{n}", String(deltaMin));
  const deltaHour = Math.floor(deltaMin / 60);
  if (deltaHour < 24)
    return t("workspace.time.hours", "{n}h ago").replace("{n}", String(deltaHour));
  const deltaDay = Math.floor(deltaHour / 24);
  return t("workspace.time.days", "{n}d ago").replace("{n}", String(deltaDay));
}

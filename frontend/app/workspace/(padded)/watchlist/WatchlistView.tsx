"use client";

// Watchlist editor.
//
// The page has three jobs:
//   1. Explain what a watchlist is and how alerts flow from a match.
//   2. Make it effortless to add the right kind of item (company /
//      sector / region / keyword), with preset chips and type-aware
//      placeholders so a first-time user never guesses what to type.
//   3. Show the user their current items + a one-click "summarise"
//      action that works even when the LLM prose layer is offline.
//
// Form submission is still a plain POST (server action in
// /api/workspace/watchlist) so it works without JS. The client state is
// only used for UX sugar: the selected type controls the placeholder,
// the help line, and the chip row.

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Bookmark, FileText, Radar, Send, Sparkles } from "lucide-react";
import {
  Eyebrow,
  SerifHeading,
  Card,
  CardBody,
  Badge,
} from "@/components/ui/primitives";
import { Pagination } from "@/components/ui/Pagination";
import { RefreshPipelineButton } from "@/components/workspace/RefreshPipelineButton";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const PER_PAGE = 12;

// Lazy-load the globe so the watchlist TTI stays snappy. The WebGL
// bundle (three.js + react-globe.gl) is ~500 KB gzipped — heavy on
// first load but worth it once the user lands on the page.
const SignalGlobe = dynamic(
  () => import("@/components/workspace/SignalGlobe").then((m) => m.SignalGlobe),
  {
    ssr: false,
    loading: () => (
      <div
        className="bg-navy-800/60 rounded-full animate-pulse"
        style={{ width: 220, height: 220 }}
      />
    ),
  },
);

type Kind = "COMPANY" | "SECTOR" | "REGION" | "KEYWORD";

interface Item {
  id: string;
  kind: string;
  value: string;
  label: string;
}

interface Preset {
  value: string;
  labelKey: string;
  labelFallback: string;
}

// Preset library. The `value` is what the pipeline matches on (exact
// text), `labelFallback` is the human-friendly English name shown on
// alerts. Both are translated through the dictionary at render time,
// so Arabic users see Arabic preset labels.
const PRESETS: Record<Kind, Preset[]> = {
  COMPANY: [
    { value: "G42", labelKey: "workspace.watchlist.preset.company.g42", labelFallback: "G42 (UAE AI group)" },
    { value: "Mubadala", labelKey: "workspace.watchlist.preset.company.mubadala", labelFallback: "Mubadala Investment Company" },
    { value: "Emirates NBD", labelKey: "workspace.watchlist.preset.company.enbd", labelFallback: "Emirates NBD" },
    { value: "IHC", labelKey: "workspace.watchlist.preset.company.ihc", labelFallback: "International Holding Company" },
    { value: "ADNOC", labelKey: "workspace.watchlist.preset.company.adnoc", labelFallback: "ADNOC" },
  ],
  SECTOR: [
    { value: "fintech", labelKey: "workspace.watchlist.preset.sector.fintech", labelFallback: "Fintech" },
    { value: "real_estate", labelKey: "workspace.watchlist.preset.sector.realEstate", labelFallback: "Real Estate" },
    { value: "ai", labelKey: "workspace.watchlist.preset.sector.ai", labelFallback: "AI and Data" },
    { value: "energy", labelKey: "workspace.watchlist.preset.sector.energy", labelFallback: "Energy and Sustainability" },
    { value: "logistics", labelKey: "workspace.watchlist.preset.sector.logistics", labelFallback: "Logistics" },
  ],
  REGION: [
    { value: "AE", labelKey: "workspace.watchlist.preset.region.ae", labelFallback: "United Arab Emirates" },
    { value: "SA", labelKey: "workspace.watchlist.preset.region.sa", labelFallback: "Saudi Arabia" },
    { value: "EG", labelKey: "workspace.watchlist.preset.region.eg", labelFallback: "Egypt" },
    { value: "MENA", labelKey: "workspace.watchlist.preset.region.mena", labelFallback: "MENA region" },
  ],
  KEYWORD: [
    { value: "Series A", labelKey: "workspace.watchlist.preset.keyword.seriesA", labelFallback: "Series A funding rounds" },
    { value: "expansion", labelKey: "workspace.watchlist.preset.keyword.expansion", labelFallback: "Market expansion" },
    { value: "partnership", labelKey: "workspace.watchlist.preset.keyword.partnership", labelFallback: "Strategic partnerships" },
    { value: "IPO", labelKey: "workspace.watchlist.preset.keyword.ipo", labelFallback: "IPO intent" },
  ],
};

export function WatchlistView({ items }: { items: Item[] }) {
  const { t } = useLocale();
  const [kind, setKind] = useState<Kind>("COMPANY");
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [page, setPage] = useState(1);

  // If an item is deleted and we were on the last page, back off to the
  // new last page instead of stranding the user on an empty one.
  useEffect(() => { setPage(1); }, [items.length === 0]);

  const totalPages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PER_PAGE;
  const pageEnd = pageStart + PER_PAGE;
  const paginated = useMemo(
    () => items.slice(pageStart, pageEnd),
    [items, pageStart, pageEnd],
  );

  const placeholderKey = `workspace.watchlist.placeholder.${kind.toLowerCase()}.value`;
  const placeholderFallback = PLACEHOLDER_FALLBACKS[kind].value;
  const labelPlaceholderKey = `workspace.watchlist.placeholder.${kind.toLowerCase()}.label`;
  const labelPlaceholderFallback = PLACEHOLDER_FALLBACKS[kind].label;
  const helpKey = `workspace.watchlist.help.${kind.toLowerCase()}`;
  const helpFallback = HELP_FALLBACKS[kind];

  function applyPreset(preset: Preset) {
    setValue(preset.value);
    setLabel(t(preset.labelKey, preset.labelFallback));
  }

  return (
    <>
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="mb-6 md:mb-8 flex items-start justify-between flex-wrap gap-4">
        <div className="min-w-0">
          <Eyebrow>{t("workspace.nav.watchlist")}</Eyebrow>
          <SerifHeading level={1} className="mt-2">
            {t("workspace.watchlist.title", "Watchlist")}
          </SerifHeading>
          <p className="mt-2 text-ink-500 max-w-2xl text-sm md:text-base">
            {t(
              "workspace.watchlist.subtitle",
              "Flag companies, sectors, regions or keywords. Any signal that matches one of these will surface in your inbox and in the channels you connect.",
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <RefreshPipelineButton size="md" />
          {items.length > 0 && (
            <form action="/api/workspace/ai/summarise-watchlist" method="post">
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-4 h-10 rounded-[3px] bg-gold-500 text-navy-900 text-sm font-semibold hover:bg-gold-400 whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4" />
                {t(
                  "workspace.watchlist.briefingCta",
                  "Summarise today's matches",
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* ── Globe hero ──────────────────────────────────────────── */}
      <GlobeHero />

      {/* ── How it works (3-step strip) ─────────────────────────── */}
      <HowItWorksStrip />

      {/* ── Add form ─────────────────────────────────────────────── */}
      <Card className="mb-6">
        <CardBody className="p-4 md:p-6">
          <div className="mb-4">
            <h2 className="text-[11px] uppercase tracking-[0.24em] text-gold-600 font-semibold">
              {t("workspace.watchlist.addTitle", "Add to your watchlist")}
            </h2>
            <p className="mt-1 text-xs text-ink-500">
              {t(
                "workspace.watchlist.addHint",
                "Pick a type, then paste a name or pick one of the suggestions.",
              )}
            </p>
          </div>

          <form
            action="/api/workspace/watchlist"
            method="post"
            className="grid grid-cols-1 sm:grid-cols-[130px_1fr] md:flex md:items-end gap-3"
          >
            <label className="block">
              <span className="text-[11px] md:text-xs uppercase tracking-[0.2em] text-ink-500">
                {t("workspace.watchlist.field.kind", "Type")}
              </span>
              <select
                name="kind"
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value as Kind);
                  // Reset inputs when type changes so stale examples
                  // don't stick around and confuse the user.
                  setValue("");
                  setLabel("");
                }}
                className="mt-1.5 md:mt-2 w-full h-10 px-2 rounded-[3px] border border-line bg-white text-sm"
              >
                <option value="COMPANY">{t("workspace.watchlist.kind.company")}</option>
                <option value="SECTOR">{t("workspace.watchlist.kind.sector")}</option>
                <option value="REGION">{t("workspace.watchlist.kind.region")}</option>
                <option value="KEYWORD">{t("workspace.watchlist.kind.keyword")}</option>
              </select>
            </label>

            <label className="block md:flex-1 md:min-w-[200px]">
              <span className="text-[11px] md:text-xs uppercase tracking-[0.2em] text-ink-500">
                {t("workspace.watchlist.field.value", "What to watch")}
              </span>
              <input
                name="value"
                required
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={t(placeholderKey, placeholderFallback)}
                className="mt-1.5 md:mt-2 w-full h-10 px-3 rounded-[3px] border border-line bg-white text-sm"
              />
            </label>

            <label className="block md:flex-1 md:min-w-[200px] sm:col-span-2 md:col-span-1">
              <span className="text-[11px] md:text-xs uppercase tracking-[0.2em] text-ink-500">
                {t("workspace.watchlist.field.label", "Display name")}
              </span>
              <input
                name="label"
                required
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t(labelPlaceholderKey, labelPlaceholderFallback)}
                className="mt-1.5 md:mt-2 w-full h-10 px-3 rounded-[3px] border border-line bg-white text-sm"
              />
            </label>

            <button
              type="submit"
              className="h-10 px-4 rounded-[3px] bg-navy-800 text-white text-sm font-medium hover:bg-navy-700 sm:col-span-2 md:col-span-1"
            >
              {t("workspace.watchlist.addBtn", "Add to watchlist")}
            </button>
          </form>

          {/* Type-aware help line */}
          <p className="mt-3 text-[12px] text-ink-500 leading-relaxed">
            {t(helpKey, helpFallback)}
          </p>

          {/* Preset chips */}
          <div className="mt-4 pt-4 border-t border-line">
            <div className="text-[10px] uppercase tracking-[0.24em] text-ink-500 font-semibold mb-2.5">
              {t("workspace.watchlist.presetsTitle", "Popular suggestions")}
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESETS[kind].map((p) => (
                <button
                  key={`${kind}-${p.value}`}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full border border-line bg-sand-50 hover:bg-navy-50 hover:border-navy-200 text-xs text-navy-800 transition-colors"
                >
                  {t(p.labelKey, p.labelFallback)}
                </button>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* ── Current items ───────────────────────────────────────── */}
      {items.length === 0 ? (
        <EmptyOnboarding kind={kind} onPresetPick={applyPreset} />
      ) : (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-[11px] uppercase tracking-[0.24em] text-gold-600 font-semibold">
              {t("workspace.watchlist.listTitle", "Your watchlist")}{" "}
              <span className="text-ink-400">({items.length})</span>
            </h2>
          </div>
          <div className="space-y-3">
            {paginated.map((it) => (
              <Card key={it.id}>
                <CardBody className="p-4 md:p-5 flex items-center gap-3 md:gap-4">
                  <Badge tone="navy" className="shrink-0">
                    {t(`workspace.watchlist.kind.${it.kind.toLowerCase()}`, it.kind)}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-navy-800 truncate text-sm md:text-base">
                      {it.label}
                    </div>
                    <div className="text-[11px] md:text-xs text-ink-500 truncate">
                      {t("workspace.watchlist.matchesOn", "Matches on")}:{" "}
                      <span className="font-mono">{it.value}</span>
                    </div>
                  </div>
                  <form
                    action={`/api/workspace/watchlist/${it.id}`}
                    method="post"
                    className="shrink-0"
                  >
                    <input type="hidden" name="_method" value="DELETE" />
                    <button
                      type="submit"
                      className="text-xs px-3 h-8 rounded-[3px] border border-line bg-white text-ink-500 hover:text-navy-800 hover:border-navy-300"
                    >
                      {t("workspace.watchlist.remove", "Remove")}
                    </button>
                  </form>
                </CardBody>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageStart={pageStart}
              pageEnd={Math.min(pageEnd, items.length)}
              totalItems={items.length}
              itemNounKey="common.pagination.noun.items"
              itemNounFallback="items"
              onChange={(p) => {
                setPage(p);
                if (typeof window !== "undefined") {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
            />
          )}
        </section>
      )}
    </>
  );
}

// ── How it works strip ────────────────────────────────────────────

function HowItWorksStrip() {
  const { t } = useLocale();
  const steps = [
    {
      Icon: Bookmark,
      n: "1",
      title: t("workspace.watchlist.how.step1.title", "Flag what matters"),
      body: t(
        "workspace.watchlist.how.step1.body",
        "Pick a company, sector, region, or keyword. You can have as many as you want.",
      ),
    },
    {
      Icon: Radar,
      n: "2",
      title: t("workspace.watchlist.how.step2.title", "We scan continuously"),
      body: t(
        "workspace.watchlist.how.step2.body",
        "The pipeline reads 18+ news and data sources every refresh, scoring every signal.",
      ),
    },
    {
      Icon: Send,
      n: "3",
      title: t("workspace.watchlist.how.step3.title", "Alerts routed to you"),
      body: t(
        "workspace.watchlist.how.step3.body",
        "Matches land in your inbox, and in any Slack, Teams, Email, or webhook channels you connect.",
      ),
    },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6 md:mb-8">
      {steps.map((s) => (
        <div
          key={s.n}
          className="flex items-start gap-3 p-4 rounded-[4px] border border-line bg-sand-50"
        >
          <div className="w-9 h-9 rounded-full bg-gold-100 text-gold-700 flex items-center justify-center shrink-0">
            <s.Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase tracking-[0.2em] text-gold-700 font-semibold">
                {s.n}
              </span>
              <span className="text-sm font-semibold text-navy-800">{s.title}</span>
            </div>
            <p className="text-[12px] text-ink-500 leading-relaxed">{s.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Empty-state onboarding ────────────────────────────────────────

function EmptyOnboarding({
  kind,
  onPresetPick,
}: {
  kind: Kind;
  onPresetPick: (p: Preset) => void;
}) {
  const { t } = useLocale();
  return (
    <Card className="border-dashed">
      <CardBody className="p-6 md:p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-gold-50 text-gold-700 flex items-center justify-center mx-auto mb-4">
          <FileText className="w-5 h-5" />
        </div>
        <h3 className="headline-serif text-navy-800 text-xl md:text-2xl mb-2">
          {t("workspace.watchlist.empty.title", "You haven't added anything yet")}
        </h3>
        <p className="text-sm text-ink-500 max-w-md mx-auto mb-5 leading-relaxed">
          {t(
            "workspace.watchlist.empty.body",
            "The watchlist is empty, so the feed is showing everything. Pick one of the quick starts below, or use the form above to add your own.",
          )}
        </p>
        <div className="flex flex-wrap gap-2 justify-center max-w-md mx-auto">
          {PRESETS[kind].slice(0, 4).map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => onPresetPick(p)}
              className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full border border-navy-200 bg-white hover:bg-navy-50 text-xs text-navy-800 transition-colors"
            >
              {t(p.labelKey, p.labelFallback)}
            </button>
          ))}
        </div>
        <p className="mt-4 text-[11px] text-ink-400">
          {t(
            "workspace.watchlist.empty.tip",
            "Click a suggestion to pre-fill the form, then press Add to watchlist.",
          )}
        </p>
      </CardBody>
    </Card>
  );
}

// ── Fallback strings (used only when the dictionary lookup misses) ─

const PLACEHOLDER_FALLBACKS: Record<Kind, { value: string; label: string }> = {
  COMPANY: {
    value: "Company name, e.g. G42 or Mubadala",
    label: "A friendly name shown on alerts",
  },
  SECTOR: {
    value: "Sector slug, e.g. fintech or real_estate",
    label: "How you want it labelled, e.g. Fintech",
  },
  REGION: {
    value: "ISO country code (AE, SA, EG) or MENA",
    label: "Display name, e.g. United Arab Emirates",
  },
  KEYWORD: {
    value: "Any word or phrase to watch for",
    label: "Short label for this keyword",
  },
};

const HELP_FALLBACKS: Record<Kind, string> = {
  COMPANY:
    "We match on the exact company name and known aliases. Start with the common English name; aliases are picked up automatically.",
  SECTOR:
    "Use one of our sector slugs: fintech, real_estate, ai, energy, logistics, healthcare, retail, mobility. The pipeline tags every signal with these slugs.",
  REGION:
    "Use the ISO 3166 country code (AE for United Arab Emirates, SA for Saudi Arabia, etc.) or MENA for the wider region. Signals with a matching HQ or expansion target will surface.",
  KEYWORD:
    "Any word or phrase. Matches are case-insensitive and happen against signal headlines and summaries.",
};

// ── Globe hero band ───────────────────────────────────────────────
//
// Full-width navy band sitting above the How-it-works strip. Left side
// is the narrative (serif headline + 2 data tiles). Right side is the
// lazy-loaded 3D globe rendering live arcs from signal origins to Dubai.
//
// Stacks vertically on mobile (< md). Dims the globe on low-motion
// preferences (handled inside the SignalGlobe component itself). Height
// is intentionally bounded so the form below stays within one scroll.

function GlobeHero() {
  const { t } = useLocale();
  return (
    <section
      className="mb-6 md:mb-8 rounded-[6px] overflow-hidden border border-navy-800/20 bg-navy-900 relative"
      aria-label={t("workspace.watchlist.globeHero.aria", "Live global signal flows")}
    >
      {/* Radial accent behind the globe */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          background:
            "radial-gradient(600px 300px at 85% 50%, rgba(182,146,94,0.18), transparent 60%)",
        }}
      />
      <div className="relative flex flex-col md:flex-row items-center gap-4 md:gap-6 px-4 md:px-6 py-4 md:py-5">
        {/* Narrative */}
        <div className="flex-1 min-w-0 text-center md:text-start">
          <div className="text-[10px] md:text-[11px] uppercase tracking-[0.24em] text-gold-400 font-semibold">
            {t("workspace.watchlist.globeHero.eyebrow", "Live pipeline")}
          </div>
          <h2 className="headline-serif text-white text-xl md:text-2xl leading-tight mt-2">
            {t(
              "workspace.watchlist.globeHero.title",
              "Global investment flows, mapped live.",
            )}
          </h2>
          <p className="mt-2 text-xs md:text-sm text-sand-100/80 leading-relaxed max-w-lg mx-auto md:mx-0">
            {t(
              "workspace.watchlist.globeHero.body",
              "Every arc is a real company signal detected from 18+ news and data sources, streaming to Dubai in real time.",
            )}
          </p>
        </div>
        {/* Globe */}
        <div className="shrink-0">
          <SignalGlobe size={220} />
        </div>
      </div>
    </section>
  );
}

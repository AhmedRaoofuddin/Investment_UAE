"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import type { Signal } from "@/lib/types";
import { Badge } from "@/components/ui/primitives";
import { cn, relativeTime } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const TYPE_KEY: Record<Signal["type"], string> = {
  funding: "signalType.funding",
  expansion: "signalType.expansion",
  hiring: "signalType.hiring",
  partnership: "signalType.partnership",
  launch: "signalType.launch",
  regulatory: "signalType.regulatory",
  m_and_a: "signalType.m_and_a",
  executive: "signalType.executive",
};

const STRENGTH_KEY: Record<Signal["strength"], string> = {
  high: "platform.signals.strengthLabel.high",
  medium: "platform.signals.strengthLabel.medium",
  low: "platform.signals.strengthLabel.low",
};

// Per-type gradient used when the RSS feed didn't expose an article
// image (Google News RSS entries in particular — their URLs no longer
// resolve server-side to the source publisher). Mirrors the ministry's
// colour palette: navy-to-gold with accent hues per signal category.
const TYPE_GRADIENT: Record<Signal["type"], string> = {
  funding:     "from-emerald-700 via-emerald-800 to-navy-900",
  expansion:   "from-sky-700 via-sky-800 to-navy-900",
  hiring:      "from-slate-600 via-slate-700 to-navy-900",
  partnership: "from-purple-700 via-purple-800 to-navy-900",
  launch:      "from-gold-600 via-gold-700 to-navy-900",
  regulatory:  "from-indigo-700 via-indigo-800 to-navy-900",
  m_and_a:     "from-rose-700 via-rose-800 to-navy-900",
  executive:   "from-amber-700 via-amber-800 to-navy-900",
};

const STRENGTH_TONE: Record<
  Signal["strength"],
  "success" | "warning" | "default"
> = {
  high: "success",
  medium: "warning",
  low: "default",
};

function truncate(text: string, maxLen: number): string {
  if (!text || text.length <= maxLen) return text || "";
  // Cut at last space before maxLen
  const cut = text.lastIndexOf(" ", maxLen);
  return text.slice(0, cut > 0 ? cut : maxLen) + "...";
}

export function SignalCard({ signal, companyName }: { signal: Signal; companyName?: string }) {
  const { t } = useLocale();
  const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(
    `${signal.headline} ${signal.source.source_name}`
  )}`;

  const rationale = truncate(signal.rationale, 200);

  return (
    <div className="surface-card overflow-hidden hover:translate-y-[-1px] flex flex-col">
      <SignalMedia signal={signal} />
      <div className="p-4 md:p-6 flex flex-col flex-1">
      <div className="flex items-center gap-2 md:gap-3 mb-3 flex-wrap">
        <Badge tone="navy">{t(TYPE_KEY[signal.type])}</Badge>
        <Badge tone={STRENGTH_TONE[signal.strength]}>
          {t(STRENGTH_KEY[signal.strength])}
        </Badge>
        <span className="ml-auto text-[11px] text-ink-400 uppercase tracking-wider">
          {relativeTime(signal.detected_at)}
        </span>
      </div>

      {companyName && (
        <div className="text-[10.5px] uppercase tracking-[0.22em] text-gold-600 mb-2 font-medium truncate">
          {companyName}
        </div>
      )}

      <h4 className="headline-serif text-navy-800 text-base md:text-lg leading-snug mb-2 md:mb-3 line-clamp-2">
        {signal.headline}
      </h4>
      <p className="text-sm text-ink-500 leading-relaxed mb-3 md:mb-4 line-clamp-3 flex-1">
        {rationale}
      </p>

      <div className="flex items-center gap-3 flex-wrap mt-auto">
        <a
          href={signal.source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-navy-700 hover:text-gold-600 font-medium transition-colors"
        >
          <ExternalLink className="w-3 h-3 shrink-0" />
          <span className="truncate max-w-[180px]">
            {signal.source.source_name} · {signal.source.source_region}
          </span>
        </a>
        <a
          href={googleSearchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-ink-400 hover:text-navy-700 transition-colors"
          title={t("signalCard.searchTitle")}
        >
          <Search className="w-3 h-3" />
          {t("signalCard.searchAction")}
        </a>
      </div>
      </div>
    </div>
  );
}

// Tiny in-tab cache so the same URL isn't scraped twice when a user
// paginates or filters and a card re-mounts.
const OG_CACHE = new Map<string, string | null>();

function useLazyOgImage(feedImage: string | null | undefined, articleUrl: string | undefined) {
  const [lazy, setLazy] = useState<string | null>(() =>
    articleUrl && OG_CACHE.has(articleUrl) ? OG_CACHE.get(articleUrl)! : null,
  );
  useEffect(() => {
    // Feed-level image wins — don't bother scraping.
    if (feedImage || !articleUrl) return;
    if (OG_CACHE.has(articleUrl)) {
      setLazy(OG_CACHE.get(articleUrl) ?? null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(
          `/api/proxy/api/og-image?url=${encodeURIComponent(articleUrl)}`,
          { cache: "force-cache" },
        );
        if (!r.ok) throw new Error(`${r.status}`);
        const data = (await r.json()) as { image_url: string | null };
        OG_CACHE.set(articleUrl, data.image_url);
        if (!cancelled) setLazy(data.image_url);
      } catch {
        OG_CACHE.set(articleUrl, null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [feedImage, articleUrl]);
  return feedImage || lazy;
}

function SignalMedia({ signal }: { signal: Signal }) {
  const { t } = useLocale();
  // Some RSS image URLs 404 or get CORS-blocked — track failure so we can
  // fall back to the gradient placeholder when the upstream image breaks.
  const [failed, setFailed] = useState(false);
  const resolvedImage = useLazyOgImage(signal.source.image_url, signal.source.url);
  const hasImage = !!resolvedImage && !failed;

  if (hasImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- unoptimized remote
      <img
        src={resolvedImage!}
        alt={signal.headline}
        loading="lazy"
        onError={() => setFailed(true)}
        className="w-full h-36 md:h-44 object-cover border-b border-line"
      />
    );
  }

  // No usable article image — render a branded gradient banner with the
  // signal type as visual anchor. Mirrors the ministry's navy/gold palette
  // and gives every card an image-like treatment so the feed reads as a
  // media wall rather than a text dump.
  return (
    <div
      className={cn(
        "relative w-full h-36 md:h-44 bg-gradient-to-br border-b border-line overflow-hidden",
        TYPE_GRADIENT[signal.type],
      )}
    >
      <div className="absolute inset-0 opacity-[0.15]" style={{
        backgroundImage:
          "repeating-linear-gradient(135deg, #fff 0 1px, transparent 1px 12px)",
      }} />
      <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
        <span className="headline-serif text-white/95 text-2xl md:text-3xl leading-none tracking-tight">
          {t(TYPE_KEY[signal.type])}
        </span>
        <span className="text-[10px] uppercase tracking-[0.22em] text-white/60 font-semibold">
          {signal.source.source_name}
        </span>
      </div>
    </div>
  );
}

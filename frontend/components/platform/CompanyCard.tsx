"use client";

import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import type { Company } from "@/lib/types";
import { Badge } from "@/components/ui/primitives";
import { ScorePill } from "@/components/ui/score-pill";
import { sectorLabel, formatUsd, relativeTime } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export function CompanyCard({ company }: { company: Company }) {
  const { t } = useLocale();
  const avg = (company.investability_score + company.uae_alignment_score) / 2;
  return (
    <Link
      href={`/platform/companies/${company.id}`}
      className="surface-card p-6 block group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            {company.headquarters?.country && (
              <span className="text-[10px] uppercase tracking-[0.2em] text-ink-400 inline-flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {company.headquarters.city ?? company.headquarters.country}
              </span>
            )}
          </div>
          <h3 className="headline-serif text-navy-800 text-xl tracking-tight leading-tight group-hover:text-gold-700 transition-colors line-clamp-1">
            {company.name}
          </h3>
          {company.description && (
            <p className="mt-2 text-sm text-ink-500 leading-relaxed line-clamp-2">
              {company.description}
            </p>
          )}
        </div>
        <ArrowUpRight className="w-4 h-4 text-ink-400 group-hover:text-gold-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all flex-shrink-0" />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-4 pt-5 border-t border-line">
        <div>
          <div className="text-[9.5px] uppercase tracking-[0.22em] text-ink-400 mb-1.5">
            {t("companyCard.composite")}
          </div>
          <ScorePill score={avg} />
        </div>
        <div>
          <div className="text-[9.5px] uppercase tracking-[0.22em] text-ink-400 mb-1.5">
            {t("companyCard.investability")}
          </div>
          <div className="text-base font-semibold text-navy-800">
            {Math.round(company.investability_score)}
            <span className="text-ink-400 text-xs"> / 100</span>
          </div>
        </div>
        <div>
          <div className="text-[9.5px] uppercase tracking-[0.22em] text-ink-400 mb-1.5">
            {t("companyCard.uaeAlignment")}
          </div>
          <div className="text-base font-semibold text-navy-800">
            {Math.round(company.uae_alignment_score)}
            <span className="text-ink-400 text-xs"> / 100</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 flex-wrap">
        {company.sectors.slice(0, 3).map((s) => (
          <Badge key={s} tone="gold">
            {sectorLabel(s)}
          </Badge>
        ))}
        {company.sectors.length > 3 && (
          <Badge>+{company.sectors.length - 3}</Badge>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-ink-400">
        <span>{company.signals.length} {t("companyCard.signalsLast")} {relativeTime(company.last_seen)}</span>
        {company.last_funding_usd ? <span>{formatUsd(company.last_funding_usd)} {t("companyCard.raised")}</span> : null}
      </div>
    </Link>
  );
}

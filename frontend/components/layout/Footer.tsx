"use client";

import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export function Footer() {
  const { t } = useLocale();

  const COLUMNS = [
    {
      title: t("footer.platform.title"),
      links: [
        { label: t("footer.platform.liveSignalFeed"), href: "/platform/signals" },
        { label: t("footer.platform.companyPipeline"), href: "/platform/companies" },
        { label: t("footer.platform.geoMap"), href: "/platform/geo" },
        { label: t("footer.platform.sectorAnalytics"), href: "/platform/sectors" },
      ],
    },
    {
      title: t("footer.invest.title"),
      links: [
        { label: t("footer.invest.whyInvest"), href: "/why-invest" },
        { label: t("footer.invest.sectors"), href: "/platform/sectors" },
        { label: t("footer.invest.freeZones"), href: "/why-invest" },
        { label: t("footer.invest.setupGuide"), href: "/why-invest" },
      ],
    },
    {
      title: t("footer.resources.title"),
      links: [
        { label: t("footer.resources.fdiReport"), href: "/reports" },
        { label: t("footer.resources.architectPaper"), href: "/reports" },
        { label: t("footer.resources.economyReport"), href: "/reports" },
        { label: t("footer.resources.allReports"), href: "/reports" },
      ],
    },
    {
      title: t("footer.ministry.title"),
      links: [
        { label: t("footer.ministry.about"), href: "/about" },
        { label: t("footer.ministry.leadership"), href: "/about" },
        { label: t("footer.ministry.newsroom"), href: "/about" },
        { label: t("footer.ministry.contact"), href: "/about" },
      ],
    },
  ];

  return (
    <footer className="mt-16 md:mt-32 bg-navy-900 text-navy-100">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-10 py-12 md:py-20 grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-12">
        <div className="md:col-span-4">
          <Logo variant="light" />
          <p className="mt-5 md:mt-6 text-sm leading-relaxed text-navy-200 max-w-sm">
            {t("footer.tagline")}
          </p>
          <div className="mt-5 md:mt-6 flex items-center gap-2">
            <span className="pulse-dot"></span>
            <span className="text-[11px] uppercase tracking-[0.2em] text-emerald-300">
              {t("footer.pipelineLive")}
            </span>
          </div>
        </div>

        <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-8">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <div className="text-[11px] uppercase tracking-[0.2em] text-gold-400">
                {col.title}
              </div>
              <ul className="mt-3 md:mt-4 space-y-2.5 md:space-y-3 text-sm">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-navy-100 hover:text-white transition-colors"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-navy-700/60">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-10 py-5 md:py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-navy-300">
          <div className="flex items-center gap-3 flex-wrap">
            <span>&copy; {new Date().getFullYear()} {t("footer.bottom.copyright")}</span>
            <span className="opacity-40">·</span>
            <span>{t("footer.bottom.allRightsReserved")}</span>
          </div>
          <div className="flex items-center gap-4 md:gap-5 flex-wrap">
            <Link href="/about" className="hover:text-white">{t("footer.bottom.privacy")}</Link>
            <Link href="/about" className="hover:text-white">{t("footer.bottom.terms")}</Link>
            <Link href="/about" className="hover:text-white">{t("footer.bottom.accessibility")}</Link>
            <Link href="/reports" className="hover:text-white">{t("footer.bottom.openData")}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

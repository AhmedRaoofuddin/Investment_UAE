"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export function OpportunityShowcase() {
  const { t } = useLocale();

  const SECTORS = [
    {
      title: t("opportunityShowcase.ai.title"),
      body: t("opportunityShowcase.ai.body"),
      accent: "bg-[radial-gradient(circle_at_top_right,rgba(201,168,120,0.18),transparent_60%)]",
    },
    {
      title: t("opportunityShowcase.fintech.title"),
      body: t("opportunityShowcase.fintech.body"),
      accent: "bg-[radial-gradient(circle_at_top_left,rgba(46,125,91,0.14),transparent_60%)]",
    },
    {
      title: t("opportunityShowcase.cleantech.title"),
      body: t("opportunityShowcase.cleantech.body"),
      accent: "bg-[radial-gradient(circle_at_bottom_right,rgba(201,168,120,0.16),transparent_60%)]",
    },
    {
      title: t("opportunityShowcase.manufacturing.title"),
      body: t("opportunityShowcase.manufacturing.body"),
      accent: "bg-[radial-gradient(circle_at_bottom_left,rgba(26,47,90,0.12),transparent_60%)]",
    },
    {
      title: t("opportunityShowcase.logistics.title"),
      body: t("opportunityShowcase.logistics.body"),
      accent: "bg-[radial-gradient(circle_at_center,rgba(201,168,120,0.10),transparent_60%)]",
    },
    {
      title: t("opportunityShowcase.healthcare.title"),
      body: t("opportunityShowcase.healthcare.body"),
      accent: "bg-[radial-gradient(circle_at_top,rgba(46,125,91,0.10),transparent_60%)]",
    },
  ];

  return (
    <section className="py-14 md:py-28 bg-white relative overflow-hidden">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10">
        <div className="flex items-end justify-between flex-wrap gap-4 md:gap-6 mb-8 md:mb-14">
          <div className="max-w-2xl">
            <span className="eyebrow">{t("opportunityShowcase.eyebrow")}</span>
            <h2 className="headline-serif text-navy-800 text-3xl md:text-4xl lg:text-5xl mt-4">
              {t("opportunityShowcase.title")}
            </h2>
          </div>
          <Link
            href="/platform/sectors"
            className="text-navy-700 hover:text-gold-600 inline-flex items-center gap-2 text-sm font-medium tracking-wide group"
          >
            {t("opportunityShowcase.viewAll")}
            <ArrowUpRight className="w-4 h-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl:-scale-x-100" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {SECTORS.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{
                duration: 0.55,
                delay: i * 0.06,
                ease: [0.22, 1, 0.36, 1],
              }}
              className={`group relative border border-line p-5 md:p-8 hover:border-navy-300 transition-all duration-500 ${s.accent}`}
            >
              <div className="flex items-start justify-between mb-6">
                <div className="text-[10px] uppercase tracking-[0.24em] text-ink-400 font-mono">
                  {String(i + 1).padStart(2, "0")} / 06
                </div>
                <ArrowUpRight className="w-4 h-4 text-navy-600 opacity-0 group-hover:opacity-100 transition-opacity rtl:-scale-x-100" />
              </div>
              <h3 className="headline-serif text-navy-800 text-2xl mb-3 tracking-tight">
                {s.title}
              </h3>
              <p className="text-ink-500 text-sm leading-relaxed">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

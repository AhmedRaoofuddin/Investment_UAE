"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export function CtaBand() {
  const { t } = useLocale();
  return (
    <section className="py-14 md:py-24 bg-white">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="relative bg-navy-800 text-white px-5 sm:px-10 lg:px-20 py-12 md:py-20 rounded-sm overflow-hidden"
        >
          <div className="absolute inset-0 pointer-events-none opacity-30 blueprint-bg" />
          <div className="absolute right-0 top-0 w-1/2 h-full bg-[radial-gradient(circle_at_right,rgba(201,168,120,0.15),transparent_70%)]" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
            <div className="lg:col-span-8">
              <span className="text-[11px] uppercase tracking-[0.24em] text-gold-400 font-medium">
                {t("ctaBand.eyebrow")}
              </span>
              <h2 className="headline-serif mt-4 text-2xl sm:text-3xl md:text-4xl lg:text-5xl leading-tight">
                {t("ctaBand.title")}
              </h2>
            </div>
            <div className="lg:col-span-4 flex lg:justify-end">
              <Link href="/platform/signals" className="btn-primary">
                {t("ctaBand.cta")}
                <ArrowRight className="w-4 h-4 rtl:-scale-x-100" />
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const TILES = [
  { icon: "/icons/ministry/radar.svg", href: "/platform/signals", key: "signals" },
  { icon: "/icons/ministry/gateway.svg", href: "/platform/companies", key: "pipeline" },
  { icon: "/icons/ministry/location.svg", href: "/platform/geo", key: "geo" },
  { icon: "/icons/ministry/sectors.svg", href: "/platform/sectors", key: "sectors" },
] as const;

export function PlatformPreview() {
  const { t } = useLocale();
  return (
    <section className="py-14 md:py-28 bg-navy-900 text-white relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 blueprint-bg opacity-50" />
      </div>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12 items-end mb-8 md:mb-14">
          <div className="lg:col-span-8">
            <span className="eyebrow text-gold-400">{t("platformPreview.eyebrow")}</span>
            <h2 className="headline-serif text-white text-3xl md:text-4xl lg:text-6xl mt-4 leading-tight">
              {t("platformPreview.title1")}
              <br />
              <span className="text-gold-400">{t("platformPreview.title2")}</span>
            </h2>
          </div>
          <p className="lg:col-span-4 text-navy-100 text-base leading-relaxed">
            {t("platformPreview.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-navy-700/40 border border-navy-700/40">
          {TILES.map((tile, i) => (
            <motion.div
              key={tile.href}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.55, delay: i * 0.08 }}
              className="bg-navy-800 hover:bg-navy-700 transition-colors duration-300 p-6 md:p-10 group"
            >
              <Link href={tile.href} className="block">
                <div className="flex items-start justify-between mb-8">
                  <div className="w-14 h-14 rounded-full bg-gold-400/10 border border-gold-400/30 flex items-center justify-center group-hover:border-gold-400 transition-colors">
                    <Image src={tile.icon} alt="" width={26} height={26} aria-hidden="true" className="brightness-[1.4]" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-navy-300 group-hover:text-gold-400 group-hover:translate-x-1 transition-all rtl:-scale-x-100" />
                </div>
                <h3 className="headline-serif text-white text-2xl md:text-3xl tracking-tight mb-3">
                  {t(`platformPreview.${tile.key}.label`)}
                </h3>
                <p className="text-navy-200 text-sm leading-relaxed max-w-md">
                  {t(`platformPreview.${tile.key}.desc`)}
                </p>
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="mt-12 flex justify-center">
          <Link href="/platform" className="btn-primary">
            {t("platformPreview.cta")}
            <ArrowRight className="w-4 h-4 rtl:-scale-x-100" />
          </Link>
        </div>
      </div>
    </section>
  );
}

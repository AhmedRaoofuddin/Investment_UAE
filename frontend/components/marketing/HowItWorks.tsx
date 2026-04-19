"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const STEPS = [
  { icon: "/icons/ministry/antenna.svg", key: "step1" },
  { icon: "/icons/ministry/brain.svg", key: "step2" },
  { icon: "/icons/ministry/fact-rank.svg", key: "step3" },
  { icon: "/icons/ministry/send.svg", key: "step4" },
] as const;

export function HowItWorks() {
  const { t } = useLocale();
  return (
    <section className="bg-sand-50 py-14 md:py-28">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10">
        <div className="max-w-3xl mb-10 md:mb-16">
          <span className="eyebrow">{t("howItWorks.eyebrow")}</span>
          <h2 className="headline-serif text-navy-800 text-3xl md:text-4xl lg:text-5xl mt-4 leading-tight">
            {t("howItWorks.title")}
          </h2>
          <p className="mt-6 text-lg text-ink-500 leading-relaxed">
            {t("howItWorks.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.key}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{
                duration: 0.6,
                delay: i * 0.1,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="bg-white p-5 md:p-8 group hover:bg-navy-800 transition-colors duration-500 ease-out"
            >
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 flex items-center justify-center border border-line group-hover:border-gold-400 transition-colors">
                  <Image src={s.icon} alt="" width={24} height={24} aria-hidden="true" />
                </div>
                <span className="text-[10px] tracking-[0.24em] uppercase text-ink-400 group-hover:text-gold-400 transition-colors">
                  {t(`howItWorks.${s.key}.eyebrow`)}
                </span>
              </div>
              <h3 className="mt-8 headline-serif text-navy-800 group-hover:text-white text-3xl tracking-tight transition-colors">
                {t(`howItWorks.${s.key}.title`)}
              </h3>
              <p className="mt-4 text-sm text-ink-500 group-hover:text-navy-100 leading-relaxed transition-colors">
                {t(`howItWorks.${s.key}.body`)}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

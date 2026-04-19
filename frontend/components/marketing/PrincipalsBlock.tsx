"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const PRINCIPLES = [
  { icon: "/icons/ministry/quality.svg", key: "transparency" },
  { icon: "/icons/ministry/business-friendly.svg", key: "aligned" },
  { icon: "/icons/ministry/target.svg", key: "precision" },
  { icon: "/icons/ministry/fact-greenfield.svg", key: "dualScore" },
] as const;

export function PrincipalsBlock() {
  const { t } = useLocale();
  return (
    <section className="py-14 md:py-28 bg-sand-50">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-16">
          <div className="lg:col-span-5">
            <span className="eyebrow">{t("principals.eyebrow")}</span>
            <h2 className="headline-serif text-navy-800 text-3xl md:text-4xl lg:text-5xl mt-4 leading-tight">
              {t("principals.title1")}
              <span className="text-gold-600"> {t("principals.title2")}</span>
            </h2>
            <p className="mt-6 text-ink-500 leading-relaxed text-base">
              {t("principals.subtitle")}
            </p>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-px bg-line border border-line">
            {PRINCIPLES.map((p, i) => (
              <motion.div
                key={p.key}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="bg-white p-8"
              >
                <Image src={p.icon} alt="" width={28} height={28} className="mb-6" aria-hidden="true" />
                <h3 className="text-navy-800 font-semibold text-base mb-2 tracking-tight">
                  {t(`principals.${p.key}.title`)}
                </h3>
                <p className="text-sm text-ink-500 leading-relaxed">
                  {t(`principals.${p.key}.body`)}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

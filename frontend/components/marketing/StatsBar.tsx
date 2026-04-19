"use client";

import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

interface Stat {
  tKey: "sources" | "window" | "companies" | "refresh";
  numeric?: number;
  suffix?: string;
}

const STATS: Stat[] = [
  { tKey: "sources", numeric: 18, suffix: "+" },
  { tKey: "window" },
  { tKey: "companies", numeric: 40, suffix: "+" },
  { tKey: "refresh" },
];

export function StatsBar() {
  return (
    <section className="border-y border-line bg-white">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10 grid grid-cols-2 md:grid-cols-4 md:divide-x divide-line">
        {STATS.map((s) => (
          <StatCell key={s.tKey} stat={s} />
        ))}
      </div>
    </section>
  );
}

function StatCell({ stat }: { stat: Stat }) {
  const { t } = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const [count, setCount] = useState(stat.numeric ? 0 : null);

  useEffect(() => {
    if (!inView || stat.numeric == null) return;
    const target = stat.numeric;
    const dur = 1200;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setCount(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, stat.numeric]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="px-4 sm:px-6 lg:px-10 py-6 md:py-10 first:pl-0 last:pr-0"
    >
      <div className="text-3xl md:text-4xl font-light text-navy-800 headline-serif tracking-tight">
        {stat.numeric != null
          ? `${count}${stat.suffix ?? ""}`
          : t(`homeStats.${stat.tKey}.value`)}
      </div>
      <div className="mt-2 text-[11px] uppercase tracking-[0.2em] text-gold-600 font-medium">
        {t(`homeStats.${stat.tKey}.label`)}
      </div>
      <div className="mt-1.5 text-sm text-ink-500 leading-snug">
        {t(`homeStats.${stat.tKey}.sub`)}
      </div>
    </motion.div>
  );
}

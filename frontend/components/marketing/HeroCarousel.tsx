"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useLocale } from "@/lib/i18n/LocaleProvider";

interface Slide {
  key: "slide1" | "slide2" | "slide3";
  primaryCtaHref: string;
  secondaryCtaHref: string;
  // Per-slide full-bleed background. Mirrored verbatim from the Ministry's
  // hero banner (https://www.investuae.gov.ae/en) into /public/hero/.
  background:
    | { type: "video"; src: string; poster: string }
    | { type: "image"; src: string };
}

const SLIDES: Slide[] = [
  {
    key: "slide1",
    primaryCtaHref: "/platform",
    secondaryCtaHref: "/reports",
    background: {
      type: "video",
      src: "/hero/ministry-video.mp4",
      poster: "/hero/ministry-video-poster.jpg",
    },
  },
  {
    key: "slide2",
    primaryCtaHref: "/platform/geo",
    secondaryCtaHref: "/platform/signals",
    background: { type: "image", src: "/hero/fdi-report.jpg" },
  },
  {
    key: "slide3",
    primaryCtaHref: "/platform/companies",
    secondaryCtaHref: "/platform/methodology",
    background: { type: "image", src: "/hero/ministry-statement.jpg" },
  },
];

export function HeroCarousel() {
  const { t } = useLocale();
  const [idx, setIdx] = useState(0);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setDirection(1);
      setIdx((i) => (i + 1) % SLIDES.length);
    }, 7500);
    return () => clearInterval(t);
  }, []);

  const goto = (next: number) => {
    setDirection(next > idx ? 1 : -1);
    setIdx((next + SLIDES.length) % SLIDES.length);
  };

  const slide = SLIDES[idx];

  return (
    <section className="relative overflow-hidden">
      <div className="relative min-h-[480px] md:min-h-[640px]">
        {/* Per-slide Ministry media, cross-faded. */}
        <AnimatePresence mode="sync">
          <motion.div
            key={`bg-${idx}`}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: "easeInOut" }}
          >
            {slide.background.type === "video" ? (
              <video
                key={slide.background.src}
                className="absolute inset-0 w-full h-full object-cover"
                src={slide.background.src}
                poster={slide.background.poster}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
              />
            ) : (
              <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: `url('${slide.background.src}')` }}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Gradient overlay — dark on the left (where copy sits), softer on
            the right so the Ministry imagery still reads through. */}
        <div className="absolute inset-0 bg-gradient-to-r from-navy-900/90 via-navy-900/75 to-navy-900/45" />
        {/* Extra bottom fade so the carousel controls stay legible. */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-navy-900/90 to-transparent" />
        {/* Light blueprint grid for the platform-data feel, kept subtle so
            the Ministry video remains the focal texture. */}
        <div className="absolute inset-0 blueprint-bg opacity-25 pointer-events-none" />

        {/* Floating data orbs — visual echo of the signal pipeline. */}
        <DataOrbs />

        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10 pt-12 md:pt-20 pb-20 md:pb-28 relative z-10">
          <AnimatePresence custom={direction} mode="wait">
            <motion.div
              key={idx}
              custom={direction}
              initial={{ opacity: 0, x: direction * 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -direction * 60 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-3xl"
            >
              <div className="flex items-center gap-3 mb-8">
                <span className="pulse-dot" />
                <span className="text-[11px] uppercase tracking-[0.24em] text-gold-300">
                  {t(`hero.${slide.key}.eyebrow`)}
                </span>
              </div>

              <h1 className="headline-serif text-white text-3xl sm:text-5xl md:text-7xl leading-[1.05] font-light mb-6 md:mb-8">
                {t(`hero.${slide.key}.titleLine1`)}
                <br />
                <span className="text-gold-400">{t(`hero.${slide.key}.titleAccent`)}</span>
              </h1>

              <p className="text-navy-100 text-base md:text-lg lg:text-xl leading-relaxed max-w-2xl mb-8 md:mb-10 font-light">
                {t(`hero.${slide.key}.subtitle`)}
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <Link href={slide.primaryCtaHref} className="btn-primary group">
                  {t(`hero.${slide.key}.primaryCta`)}
                  <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1 rtl:group-hover:translate-x-0" />
                </Link>
                <Link
                  href={slide.secondaryCtaHref}
                  className="inline-flex items-center gap-2 text-white border border-white/30 hover:border-gold-400 hover:text-gold-400 px-6 py-3.5 text-sm font-medium tracking-wide rounded-[3px] transition-colors duration-200"
                >
                  {t(`hero.${slide.key}.secondaryCta`)}
                </Link>
              </div>

              <div className="mt-12 inline-flex items-center gap-2 text-[10.5px] uppercase tracking-[0.28em] text-navy-200/70">
                <Image src="/icons/ministry/scan.svg" alt="" width={14} height={14} aria-hidden="true" />
                {t(`hero.${slide.key}.badge`)}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Carousel controls */}
        <div className="absolute bottom-6 md:bottom-10 left-4 sm:left-6 lg:left-10 right-4 sm:right-6 lg:right-10 flex items-end justify-between z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => goto(idx - 1)}
              className="p-2 rounded-full border border-white/20 text-white hover:bg-white/10 transition-colors"
              aria-label="Previous slide"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goto(i)}
                  className="group/dot py-2"
                  aria-label={`Slide ${i + 1}`}
                >
                  <span
                    className={`block h-[3px] transition-all duration-500 ${
                      i === idx ? "w-12 bg-gold-400" : "w-6 bg-white/30 group-hover/dot:bg-white/60"
                    }`}
                  />
                </button>
              ))}
            </div>
            <button
              onClick={() => goto(idx + 1)}
              className="p-2 rounded-full border border-white/20 text-white hover:bg-white/10 transition-colors"
              aria-label="Next slide"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="hidden md:flex items-center gap-2 text-white/40 text-xs font-mono">
            <span>{String(idx + 1).padStart(2, "0")}</span>
            <span className="w-px h-3 bg-white/20" />
            <span>{String(SLIDES.length).padStart(2, "0")}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function DataOrbs() {
  const points = [
    { x: 18, y: 32, delay: 0 },
    { x: 48, y: 22, delay: 0.4 },
    { x: 72, y: 42, delay: 0.8 },
    { x: 88, y: 18, delay: 1.2 },
    { x: 30, y: 58, delay: 1.6 },
    { x: 62, y: 68, delay: 2.0 },
  ];
  return (
    <div className="absolute inset-0 pointer-events-none">
      {points.map((p, i) => (
        <motion.div
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full bg-gold-400"
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
          animate={{
            opacity: [0.3, 1, 0.3],
            scale: [1, 1.6, 1],
          }}
          transition={{
            duration: 3.4,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <span className="absolute inset-0 rounded-full text-gold-400 geo-ping" />
        </motion.div>
      ))}
    </div>
  );
}

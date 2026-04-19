"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Eyebrow, Section } from "@/components/ui/primitives";
import { useLocale } from "@/lib/i18n/LocaleProvider";

// Mirrors the Ministry of Investment "Partners" carousel from
// https://www.investuae.gov.ae/en — landscape brand marks on a light card,
// uniform tile height, hover scale. Logos are mirrored locally from the
// Ministry's own /storage/post/<hash>.jpg URLs (see public/partners/).
//
// Source: GET https://website-api.investuae.gov.ae/api/v1/data/en/partners
// Listed by the Ministry under category "Key Partners".
interface Partner {
  slug: string;
  name: string;
  // Path under /public, served verbatim.
  src: string;
}

const PARTNERS: Partner[] = [
  { slug: "galadari", name: "Galadari", src: "/partners/galadari.jpg" },
  { slug: "al-tamimi", name: "Al Tamimi & Co.", src: "/partners/al-tamimi.jpg" },
  { slug: "herbert", name: "Herbert Smith Freehills", src: "/partners/herbert.jpg" },
  { slug: "habib", name: "Habib Al Mulla", src: "/partners/habib.jpg" },
  { slug: "adg-legal", name: "ADG Legal", src: "/partners/adg-legal.jpg" },
  { slug: "ey", name: "EY", src: "/partners/ey.jpg" },
  { slug: "iqvia", name: "IQVIA", src: "/partners/iqvia.jpg" },
  { slug: "strategy-and", name: "Strategy&", src: "/partners/strategy-and.jpg" },
  { slug: "fti-consulting", name: "FTI Consulting", src: "/partners/fti-consulting.jpg" },
  { slug: "kpmg", name: "KPMG", src: "/partners/kpmg.jpg" },
  { slug: "palladium", name: "Palladium", src: "/partners/palladium.jpg" },
  { slug: "cushman", name: "Cushman & Wakefield", src: "/partners/cushman.jpg" },
  { slug: "jll", name: "JLL", src: "/partners/jll.jpg" },
  { slug: "bdo", name: "BDO", src: "/partners/bdo.jpg" },
  { slug: "pwc", name: "PwC", src: "/partners/pwc.jpg" },
  { slug: "korn-ferry", name: "Korn Ferry", src: "/partners/korn-ferry.jpg" },
  { slug: "cooper-fitch", name: "Cooper Fitch", src: "/partners/cooper-fitch.jpg" },
  { slug: "creative-zone", name: "Creative Zone", src: "/partners/creative-zone.jpg" },
  { slug: "tgc", name: "TGC", src: "/partners/tgc.jpg" },
  { slug: "lancer", name: "Lancer", src: "/partners/lancer.jpg" },
];

export function PartnersStrip() {
  const { t } = useLocale();
  // Duplicate the list so the CSS keyframe `marquee-track` can scroll one full
  // length and reset without a visible seam. Keep both lists aria-hidden for
  // duplicates so screen readers don't announce 40 items.
  const looped = [...PARTNERS, ...PARTNERS];

  return (
    <Section className="py-12 md:py-16">
      <div className="flex items-end justify-between gap-4 mb-6 md:mb-8 flex-wrap">
        <div>
          <Eyebrow>{t("partnersStrip.eyebrow")}</Eyebrow>
          <h2 className="headline-serif text-navy-800 text-2xl md:text-3xl mt-2">
            {t("partnersStrip.title")}
          </h2>
        </div>
        <Link
          href="https://www.investuae.gov.ae/en/partners"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-700 hover:text-gold-600 transition-colors"
        >
          {t("partnersStrip.viewAll")}
          <ArrowRight className="w-4 h-4 rtl:-scale-x-100" />
        </Link>
      </div>

      <div className="relative overflow-hidden">
        {/* Edge fades so logos enter / exit softly into the page background. */}
        <div className="absolute inset-y-0 left-0 w-16 md:w-24 bg-gradient-to-r from-sand-50 to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-16 md:w-24 bg-gradient-to-l from-sand-50 to-transparent z-10 pointer-events-none" />

        <div className="marquee-track whitespace-nowrap">
          {looped.map((p, i) => {
            const isClone = i >= PARTNERS.length;
            return (
              <span
                key={`${p.slug}-${i}`}
                aria-hidden={isClone || undefined}
                className="inline-flex items-center justify-center align-middle mx-2 md:mx-3"
              >
                <span
                  // Uniform tile so logos of different aspect ratios all read at
                  // the same visual weight — same trick the Ministry site uses.
                  className="inline-flex items-center justify-center w-[170px] h-[88px] md:w-[200px] md:h-[100px] rounded-xl bg-white border border-line shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-navy-200 hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)] transition-all p-4"
                  title={p.name}
                >
                  <Image
                    src={p.src}
                    alt={isClone ? "" : p.name}
                    width={200}
                    height={100}
                    unoptimized
                    className="max-h-full max-w-full w-auto h-auto object-contain transition-transform duration-300 ease-out hover:scale-[1.05]"
                  />
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </Section>
  );
}

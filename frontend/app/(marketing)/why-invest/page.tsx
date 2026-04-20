"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Section, Eyebrow, SerifHeading } from "@/components/ui/primitives";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ConnectivityGlobe } from "@/components/marketing/ConnectivityGlobe";

// Icons mirrored verbatim from the Ministry's own "Investment Opportunities"
// cards on https://www.investuae.gov.ae/en.
const PILLARS = [
  { icon: "/icons/ministry/liveability.svg", key: "p1" },
  { icon: "/icons/ministry/capital.svg", key: "p2" },
  { icon: "/icons/ministry/innovation.svg", key: "p3" },
  { icon: "/icons/ministry/knowledge.svg", key: "p4" },
  { icon: "/icons/ministry/talent.svg", key: "p5" },
  { icon: "/icons/ministry/sustainability.svg", key: "p6" },
] as const;

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="headline-serif text-white text-3xl md:text-4xl leading-none">
        {value}
      </dt>
      <dd className="mt-2 text-[11px] uppercase tracking-[0.2em] text-white/55">
        {label}
      </dd>
    </div>
  );
}

export default function WhyInvestPage() {
  const { t } = useLocale();
  return (
    <>
      <Section className="pt-10 md:pt-16 pb-10 md:pb-16 overflow-x-hidden">
        <Eyebrow>{t("whyInvest.eyebrow")}</Eyebrow>
        <div className="mt-6 grid gap-8 md:gap-10 lg:gap-14 md:grid-cols-[minmax(0,1fr)_minmax(0,480px)] lg:grid-cols-[minmax(0,1fr)_minmax(0,540px)] md:items-start">
          {/* Left column: headline, subtitle, destinations list */}
          <div className="min-w-0">
            <SerifHeading level={1} className="max-w-2xl">
              {t("whyInvest.title")}
            </SerifHeading>
            <p className="mt-4 md:mt-6 max-w-xl text-base md:text-lg text-ink-500 leading-relaxed">
              {t("whyInvest.subtitle")}
            </p>

            <div className="mt-7 md:mt-10">
              <div className="text-[10px] uppercase tracking-[0.25em] text-ink-500/70">
                Live connectivity &middot; 24 destinations from Dubai &amp; Abu Dhabi
              </div>
              {/* Region list: the UAE Hubs column is promoted to first
                  position so the origin reads immediately. 4 columns on
                  large screens compresses the vertical footprint so the
                  globe column doesn't leave a sea of whitespace. */}
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-3 md:gap-x-6 md:gap-y-4 text-sm text-ink-500">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-gold-700 mb-1">
                    UAE Hubs
                  </div>
                  <div className="font-semibold text-navy-800">Dubai</div>
                  <div className="font-semibold text-navy-800">Abu Dhabi</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-gold-700 mb-1">
                    Gulf
                  </div>
                  <div>Riyadh</div>
                  <div>Doha</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-gold-700 mb-1">
                    Europe
                  </div>
                  <div>London</div>
                  <div>Paris</div>
                  <div>Frankfurt</div>
                  <div>Zurich</div>
                  <div>Istanbul</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-gold-700 mb-1">
                    Asia &amp; Pacific
                  </div>
                  <div>Singapore</div>
                  <div>Hong Kong</div>
                  <div>Tokyo</div>
                  <div>Shanghai</div>
                  <div>Seoul</div>
                  <div>Sydney</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-gold-700 mb-1">
                    Subcontinent
                  </div>
                  <div>Mumbai</div>
                  <div>Delhi</div>
                  <div>Bangalore</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-gold-700 mb-1">
                    Americas
                  </div>
                  <div>New York</div>
                  <div>San Francisco</div>
                  <div>Toronto</div>
                  <div>São Paulo</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-gold-700 mb-1">
                    Africa
                  </div>
                  <div>Cape Town</div>
                  <div>Nairobi</div>
                  <div>Lagos</div>
                  <div>Cairo</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right column: globe — on mobile it renders full-width below
              text; on md+ it sits alongside the text and sticks as the
              left column scrolls. */}
          <div className="w-full min-w-0 md:sticky md:top-24">
            <ConnectivityGlobe />
          </div>
        </div>
      </Section>

      <Section className="pb-12 md:pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-line border border-line">
          {PILLARS.map((p) => (
            <div key={p.key} className="bg-white p-5 md:p-8 group">
              <div className="w-12 h-12 rounded-md bg-gold-50 ring-1 ring-gold-100 flex items-center justify-center mb-6">
                <Image src={p.icon} alt="" width={28} height={28} aria-hidden="true" />
              </div>
              <h3 className="headline-serif text-navy-800 text-2xl mb-3 tracking-tight">
                {t(`whyInvest.${p.key}.title`)}
              </h3>
              <p className="text-sm text-ink-500 leading-relaxed">
                {t(`whyInvest.${p.key}.body`)}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section className="pb-16 md:pb-32">
        <div className="rounded-md overflow-hidden bg-navy-900 border border-navy-700">
          <div className="relative p-8 md:p-14 lg:p-16">
            <div
              className="absolute inset-0 opacity-[0.08] pointer-events-none"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 20% 20%, #E8B36C 0, transparent 45%), radial-gradient(circle at 80% 80%, #7B2D8E 0, transparent 55%)",
              }}
            />
            <div className="relative grid gap-10 lg:grid-cols-[1.6fr_1fr] lg:items-end">
              <div>
                <Eyebrow className="text-gold-400">{t("whyInvest.next.eyebrow")}</Eyebrow>
                <SerifHeading level={2} className="!text-white mt-4 max-w-3xl">
                  {t("whyInvest.next.title")}
                </SerifHeading>
                <p className="mt-5 max-w-2xl text-base md:text-lg text-white/70 leading-relaxed">
                  {t("whyInvest.next.body")}
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link href="/platform/companies" className="inline-flex btn-primary">
                    {t("whyInvest.next.primaryCta")}
                    <ArrowRight className="w-4 h-4 rtl:-scale-x-100" />
                  </Link>
                  <Link
                    href="/about"
                    className="inline-flex items-center gap-2 px-5 py-3 text-sm font-medium text-white/80 hover:text-white border border-white/20 hover:border-white/40 rounded-[3px]"
                  >
                    {t("whyInvest.next.secondaryCta")}
                  </Link>
                </div>
              </div>
              <dl className="grid grid-cols-3 gap-6 lg:gap-4 lg:border-l lg:border-white/10 lg:pl-10">
                <MiniStat value={t("whyInvest.next.stat1.value")} label={t("whyInvest.next.stat1.label")} />
                <MiniStat value={t("whyInvest.next.stat2.value")} label={t("whyInvest.next.stat2.label")} />
                <MiniStat value={t("whyInvest.next.stat3.value")} label={t("whyInvest.next.stat3.label")} />
              </dl>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}

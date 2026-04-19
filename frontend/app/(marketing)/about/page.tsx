"use client";

import { Eyebrow, Section, SerifHeading } from "@/components/ui/primitives";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export default function AboutPage() {
  const { t } = useLocale();
  return (
    <>
      <Section className="pt-10 md:pt-16 pb-8 md:pb-12 max-w-3xl">
        <Eyebrow>{t("about.eyebrow")}</Eyebrow>
        <SerifHeading level={1} className="mt-4">
          {t("about.title")}
        </SerifHeading>
        <p className="mt-6 text-lg text-ink-500 leading-relaxed">
          {t("about.intro")}
        </p>
      </Section>

      <Section className="pb-12 md:pb-24 max-w-3xl">
        <SerifHeading level={2} className="mt-12">
          {t("about.investUae.title")}
        </SerifHeading>
        <p className="mt-6 text-base text-ink-500 leading-relaxed">
          {t("about.investUae.body")}
        </p>
      </Section>

      <Section className="pb-16 md:pb-32 max-w-3xl">
        <SerifHeading level={2} className="mt-12">
          {t("about.platform.title")}
        </SerifHeading>
        <p className="mt-6 text-base text-ink-500 leading-relaxed">
          {t("about.platform.body")}
        </p>
      </Section>
    </>
  );
}

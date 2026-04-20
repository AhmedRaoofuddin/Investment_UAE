"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { Section, SerifHeading, Eyebrow } from "@/components/ui/primitives";
import { useLocale } from "@/lib/i18n/LocaleProvider";

// Self-service sign-up is disabled for the pilot. This screen tells
// visitors that access is invitation-only and points existing users to
// the sign-in page. The server action in ./actions.ts enforces the same
// policy for direct POSTs.
export function SignUpForm() {
  const { t } = useLocale();

  return (
    <Section className="py-16 md:py-24 max-w-lg">
      <Eyebrow>{t("auth.signup.comingSoon.eyebrow")}</Eyebrow>
      <SerifHeading level={1} className="mt-3">
        {t("auth.signup.comingSoon.title")}
      </SerifHeading>

      <div className="mt-8 rounded-[3px] border border-line bg-sand-50 p-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gold-50 ring-1 ring-gold-100">
            <Lock className="w-4 h-4 text-gold-700" />
          </span>
          <span className="text-xs uppercase tracking-[0.2em] text-gold-700 font-medium">
            {t("auth.signup.comingSoon.badge")}
          </span>
        </div>
        <p className="mt-4 text-ink-700 leading-relaxed">
          {t("auth.signup.comingSoon.body")}
        </p>
        <p className="mt-4 text-sm text-ink-500">
          {t("auth.signup.comingSoon.contact")}
        </p>
      </div>

      <p className="mt-8 text-sm text-ink-500">
        <Link
          href="/auth/signin"
          className="text-navy-700 hover:text-gold-600 font-medium"
        >
          {t("auth.signup.comingSoon.signInCta")}
        </Link>
      </p>
    </Section>
  );
}

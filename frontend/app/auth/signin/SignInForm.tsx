"use client";

import Link from "next/link";
import { Mail, Lock, AlertCircle } from "lucide-react";
import { Section, SerifHeading, Eyebrow } from "@/components/ui/primitives";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { doSignIn } from "./actions";

export function SignInForm({
  error,
  callbackUrl,
}: {
  error?: string;
  callbackUrl?: string;
}) {
  const { t } = useLocale();
  const errorMessage =
    error === "invalid"
      ? t("auth.signin.error.invalid")
      : error === "missing"
        ? t("auth.signin.error.missing")
        : null;

  return (
    <Section className="py-16 md:py-24 max-w-lg">
      <Eyebrow>{t("auth.signin.eyebrow")}</Eyebrow>
      <SerifHeading level={1} className="mt-3">
        {t("auth.signin.title")}
      </SerifHeading>
      <p className="mt-3 text-ink-500">{t("auth.signin.intro")}</p>

      {errorMessage && (
        <div className="mt-6 flex items-start gap-3 p-4 rounded-[3px] border border-red-300 bg-red-50 text-sm text-red-900">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {errorMessage}
        </div>
      )}

      <form action={doSignIn} className="mt-8 space-y-4">
        <input type="hidden" name="callbackUrl" value={callbackUrl ?? "/workspace"} />
        <label className="block">
          <span className="text-xs uppercase tracking-[0.2em] text-ink-500">
            {t("auth.signin.label.email")}
          </span>
          <div className="mt-2 relative">
            <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="w-full h-11 pl-10 pr-3 rounded-[3px] border border-line bg-white text-navy-800 focus:outline-none focus:border-navy-300"
              placeholder={t("auth.signin.placeholder.email")}
            />
          </div>
        </label>

        <label className="block">
          <span className="text-xs uppercase tracking-[0.2em] text-ink-500">
            {t("auth.signin.label.password")}
          </span>
          <div className="mt-2 relative">
            <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              minLength={8}
              className="w-full h-11 pl-10 pr-3 rounded-[3px] border border-line bg-white text-navy-800 focus:outline-none focus:border-navy-300"
              placeholder={t("auth.signin.placeholder.password")}
            />
          </div>
        </label>

        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-[3px] bg-navy-800 text-white font-medium hover:bg-navy-700 transition-colors"
        >
          {t("auth.signin.submit")}
        </button>
      </form>

      <p className="mt-6 text-sm text-ink-500">
        {t("auth.signin.noAccount")}{" "}
        <Link href="/auth/signup" className="text-navy-700 hover:text-gold-600 font-medium">
          {t("auth.signin.createOne")}
        </Link>
      </p>

      <p className="mt-6 text-xs text-ink-500 leading-relaxed">
        {t("auth.signin.footer")}
      </p>
    </Section>
  );
}

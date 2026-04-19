"use client";

// Client-side locale context. No next-intl, no URL prefix — a simple
// React context + localStorage so the EN/AR toggle in the header flips
// every translated string instantly and survives page reloads.
//
// Why no next-intl? The platform is a single Next.js app with ~25 pages
// already routed; retrofitting `[locale]` segments would mean restructuring
// every route. A context-based t() function ships faster and fits the
// marketing+platform split where most strings live in React trees.
//
// Direction handling: when `locale === "ar"` we set `document.documentElement`
// `lang="ar"` and `dir="rtl"`. Tailwind's `rtl:` modifier picks up from
// the html dir automatically, so individual components can opt into
// mirrored margins/paddings where needed.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { DICTIONARIES, type Locale } from "./dictionary";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Look up a string; falls back to the English dictionary then the key itself. */
  t: (key: string, fallback?: string) => string;
  dir: "ltr" | "rtl";
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

const STORAGE_KEY = "investuae.locale";

function readInitialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "ar" || stored === "en") return stored;
  } catch {
    // localStorage blocked (private mode) — fall through.
  }
  const nav = window.navigator?.language?.toLowerCase() ?? "";
  return nav.startsWith("ar") ? "ar" : "en";
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  // We render server-side as "en" then re-hydrate with the stored
  // preference on mount. Using `useState(() => ...)` reads localStorage
  // synchronously on first client render.
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    setLocaleState(readInitialLocale());
  }, []);

  // Sync lang + dir attributes on <html> whenever locale changes so every
  // page / layout picks up RTL without needing its own effect.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.lang = locale;
    root.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore — non-critical.
    }
  }, []);

  const t = useCallback(
    (key: string, fallback?: string) => {
      const dict = DICTIONARIES[locale];
      if (dict && key in dict) return dict[key];
      // Fall back to English so a missing AR translation still shows
      // something readable rather than the raw dot-notation key.
      const enDict = DICTIONARIES.en;
      if (enDict && key in enDict) return enDict[key];
      return fallback ?? key;
    },
    [locale],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      dir: locale === "ar" ? "rtl" : "ltr",
    }),
    [locale, setLocale, t],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    // Soft fallback — if a component somehow renders outside the
    // provider (e.g. a Storybook preview), default to English so nothing
    // crashes. Production paths are always wrapped by the root layout.
    return {
      locale: "en",
      setLocale: () => {},
      t: (key, fallback) => DICTIONARIES.en[key] ?? fallback ?? key,
      dir: "ltr",
    };
  }
  return ctx;
}

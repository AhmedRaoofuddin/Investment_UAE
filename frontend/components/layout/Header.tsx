"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { Globe, ChevronDown, Search, Menu, X, ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/LocaleProvider";

interface NavItem {
  labelKey: string;
  href: string;
  children?: { labelKey: string; href: string }[];
}

const NAV: NavItem[] = [
  { labelKey: "header.nav.home", href: "/" },
  {
    labelKey: "header.nav.invest",
    href: "/why-invest",
    children: [
      { labelKey: "header.nav.invest.whyInvest", href: "/why-invest" },
      { labelKey: "header.nav.invest.sectors", href: "/platform/sectors" },
      { labelKey: "header.nav.invest.opportunities", href: "/platform/companies" },
    ],
  },
  {
    labelKey: "header.nav.platform",
    href: "/platform",
    children: [
      { labelKey: "header.nav.platform.signals", href: "/platform/signals" },
      { labelKey: "header.nav.platform.pipeline", href: "/platform/companies" },
      { labelKey: "header.nav.platform.geo", href: "/platform/geo" },
      { labelKey: "header.nav.platform.sectors", href: "/platform/sectors" },
    ],
  },
  { labelKey: "header.nav.reports", href: "/reports" },
  { labelKey: "header.nav.about", href: "/about" },
];

const SEARCH_PAGES = [
  { title: "Home", href: "/", keywords: "home main landing" },
  { title: "Why Invest in the UAE", href: "/why-invest", keywords: "why invest uae geography capital funds talent free zones" },
  { title: "About the Ministry", href: "/about", keywords: "about ministry investment platform signal detection" },
  { title: "Reports & Data", href: "/reports", keywords: "reports data fdi publications download pdf whitepaper economy" },
  { title: "Signal Detection Platform", href: "/platform", keywords: "platform dashboard overview signals companies" },
  { title: "Live Signal Feed", href: "/platform/signals", keywords: "signals feed live funding expansion partnership launch hiring" },
  { title: "Company Pipeline", href: "/platform/companies", keywords: "companies pipeline investment search filter sector" },
  { title: "Geo-Intelligence Map", href: "/platform/geo", keywords: "geo map geography locations headquarters expansion targets" },
  { title: "Sector Analytics", href: "/platform/sectors", keywords: "sectors analytics charts fintech ai cleantech healthcare" },
];

export function Header() {
  const pathname = usePathname();
  const { locale, setLocale, t } = useLocale();
  const [scrolled, setScrolled] = useState(false);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileAccordion, setMobileAccordion] = useState<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
    setSearchQuery("");
  }, [pathname]);

  // Lock body scroll when mobile menu or search is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen || searchOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen, searchOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [searchOpen]);

  // Handle keyboard shortcut (Ctrl/Cmd+K) for search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setSearchQuery("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const searchResults = searchQuery.trim()
    ? SEARCH_PAGES.filter((p) => {
        const hay = `${p.title} ${p.keywords}`.toLowerCase();
        return searchQuery
          .toLowerCase()
          .split(/\s+/)
          .every((word) => hay.includes(word));
      })
    : [];

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 w-full transition-all duration-300",
          scrolled
            ? "bg-white/90 backdrop-blur-md border-b border-line shadow-[0_1px_0_rgba(8,21,44,0.04)]"
            : "bg-white/60 backdrop-blur-sm border-b border-transparent",
        )}
      >
        {/* Top utility strip */}
        <div className="hidden md:flex items-center justify-between h-7 px-6 lg:px-10 text-[11px] text-ink-400 border-b border-line/60">
          <div className="flex items-center gap-4 tracking-wide">
            <span className="uppercase">{t("header.topBar.country")}</span>
            <span className="opacity-30">·</span>
            <span>{t("header.topBar.official")}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocale("en")}
              className={cn(
                "inline-flex items-center gap-1 transition-colors",
                locale === "en" ? "text-navy-800 font-semibold" : "hover:text-navy-700",
              )}
              aria-pressed={locale === "en"}
            >
              <Globe className="w-3 h-3" /> EN
            </button>
            <span className="opacity-30">·</span>
            <button
              onClick={() => setLocale("ar")}
              className={cn(
                "transition-colors",
                locale === "ar" ? "text-navy-800 font-semibold" : "hover:text-navy-700",
              )}
              aria-pressed={locale === "ar"}
            >
              عربي
            </button>
          </div>
        </div>

        {/* Main nav */}
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-10 flex items-center justify-between h-[64px] md:h-[76px] gap-3">
          <Link href="/" className="shrink-0" onClick={() => setMobileOpen(false)}>
            <Logo />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center">
            {NAV.map((item, idx) => {
              const active =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <div
                  key={item.href}
                  className="relative"
                  onMouseEnter={() => item.children && setOpenIdx(idx)}
                  onMouseLeave={() => setOpenIdx(null)}
                >
                  <Link
                    href={item.href}
                    data-active={active}
                    className={cn(
                      "gold-underline px-3 py-5 text-[13.5px] font-medium tracking-wide inline-flex items-center gap-1.5",
                      active ? "text-navy-900" : "text-navy-700 hover:text-navy-900",
                    )}
                  >
                    {t(item.labelKey)}
                    {item.children && (
                      <ChevronDown
                        className={cn(
                          "w-3 h-3 transition-transform duration-200",
                          openIdx === idx && "rotate-180",
                        )}
                      />
                    )}
                  </Link>

                  {item.children && openIdx === idx && (
                    <div className="absolute top-full left-0 pt-1 z-50">
                      <div className="bg-white border border-line shadow-[0_24px_60px_-20px_rgba(8,21,44,0.15)] min-w-[240px] rounded-md overflow-hidden slide-enter">
                        {item.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className="block px-5 py-3 text-sm text-navy-700 hover:bg-sand-100 hover:text-navy-900 border-b border-line last:border-b-0 transition-colors"
                          >
                            {t(child.labelKey)}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <button
              aria-label="Search"
              onClick={() => setSearchOpen(true)}
              className="p-2 rounded-full hover:bg-sand-200 text-navy-700 transition-colors"
            >
              <Search className="w-4 h-4" />
            </button>
            {/* Sign in — opens the v2 investor workspace. Kept text-only
                so the gold CTA stays visually dominant. */}
            <Link
              href="/auth/signin"
              className="hidden md:inline-flex items-center text-[13px] font-medium text-navy-700 hover:text-gold-600 px-2 py-2 transition-colors"
            >
              {t("header.cta.signIn")}
            </Link>
            <Link
              href="/platform"
              className="hidden md:inline-flex items-center gap-2 bg-gold-500 text-navy-900 font-semibold text-[13px] px-4 py-2 rounded-[4px] hover:bg-gold-400 transition-colors"
            >
              {t("header.cta.launch")}
            </Link>
            {/* Mobile hamburger */}
            <button
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 rounded-full hover:bg-sand-200 text-navy-700 transition-colors"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* ─── Mobile menu drawer ─── */}
      {/* z-[1000] so the drawer sits above Leaflet's built-in 800 on /platform/geo */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[1000] lg:hidden">
          <div
            className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute top-0 right-0 w-[85%] max-w-sm h-full bg-white shadow-2xl overflow-y-auto animate-slide-in-right">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <Logo />
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-full hover:bg-sand-200 text-navy-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="py-4">
              {NAV.map((item, idx) => (
                <div key={item.href}>
                  {item.children ? (
                    <>
                      <button
                        onClick={() =>
                          setMobileAccordion(mobileAccordion === idx ? null : idx)
                        }
                        className="w-full flex items-center justify-between px-5 py-3.5 text-[15px] font-medium text-navy-800 hover:bg-sand-50 transition-colors"
                      >
                        {t(item.labelKey)}
                        <ChevronDown
                          className={cn(
                            "w-4 h-4 text-ink-400 transition-transform duration-200",
                            mobileAccordion === idx && "rotate-180",
                          )}
                        />
                      </button>
                      {mobileAccordion === idx && (
                        <div className="bg-sand-50 border-y border-line">
                          {item.children.map((child) => (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={() => setMobileOpen(false)}
                              className={cn(
                                "block px-8 py-3 text-sm transition-colors",
                                pathname === child.href
                                  ? "text-navy-900 font-medium bg-gold-50"
                                  : "text-navy-700 hover:text-navy-900",
                              )}
                            >
                              {t(child.labelKey)}
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <Link
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "block px-5 py-3.5 text-[15px] font-medium transition-colors",
                        pathname === item.href
                          ? "text-navy-900 bg-gold-50"
                          : "text-navy-800 hover:bg-sand-50",
                      )}
                    >
                      {t(item.labelKey)}
                    </Link>
                  )}
                </div>
              ))}
            </nav>

            <div className="px-5 py-6 border-t border-line space-y-3">
              <Link
                href="/platform"
                onClick={() => setMobileOpen(false)}
                className="btn-primary w-full justify-center text-sm"
              >
                Launch Platform
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/auth/signin"
                onClick={() => setMobileOpen(false)}
                className="inline-flex w-full justify-center items-center gap-2 text-sm font-medium text-navy-700 hover:text-gold-600 py-3 border border-line rounded-[3px]"
              >
                Sign in to Workspace
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="px-5 py-4 border-t border-line text-xs text-ink-400">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setLocale("en")}
                  className={cn(
                    "inline-flex items-center gap-1 transition-colors",
                    locale === "en" ? "text-navy-800 font-semibold" : "hover:text-navy-700",
                  )}
                  aria-pressed={locale === "en"}
                >
                  <Globe className="w-3 h-3" /> EN
                </button>
                <span className="opacity-30">·</span>
                <button
                  onClick={() => setLocale("ar")}
                  className={cn(
                    "transition-colors",
                    locale === "ar" ? "text-navy-800 font-semibold" : "hover:text-navy-700",
                  )}
                  aria-pressed={locale === "ar"}
                >
                  عربي
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Search overlay ─── */}
      {/* z-[1000] for the same Leaflet reason as the mobile drawer above */}
      {searchOpen && (
        <div className="fixed inset-0 z-[1000]">
          <div
            className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm"
            onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
          />
          <div className="relative max-w-2xl mx-auto mt-[12vh] px-4">
            <div className="bg-white rounded-lg shadow-2xl overflow-hidden border border-line">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-line">
                <Search className="w-5 h-5 text-ink-400 shrink-0" />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search pages, reports, platform tools..."
                  className="flex-1 text-base text-navy-800 placeholder:text-ink-400 outline-none bg-transparent"
                />
                <kbd className="hidden sm:inline-flex px-2 py-0.5 rounded text-[10px] font-mono text-ink-400 border border-line bg-sand-50">
                  ESC
                </kbd>
              </div>

              {searchQuery.trim() && (
                <div className="max-h-[50vh] overflow-y-auto">
                  {searchResults.length > 0 ? (
                    <div className="py-2">
                      {searchResults.map((r) => (
                        <Link
                          key={r.href}
                          href={r.href}
                          onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                          className="flex items-center justify-between px-5 py-3 hover:bg-sand-50 transition-colors group"
                        >
                          <div>
                            <div className="text-sm font-medium text-navy-800 group-hover:text-gold-700">
                              {r.title}
                            </div>
                            <div className="text-xs text-ink-400 mt-0.5">{r.href}</div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-ink-300 group-hover:text-gold-600 transition-colors" />
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="px-5 py-8 text-center text-sm text-ink-500">
                      No pages found for &ldquo;{searchQuery}&rdquo;
                    </div>
                  )}
                </div>
              )}

              {!searchQuery.trim() && (
                <div className="px-5 py-4">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-ink-400 font-medium mb-3">
                    Quick Links
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Signal Feed", href: "/platform/signals" },
                      { label: "Company Pipeline", href: "/platform/companies" },
                      { label: "Geo Map", href: "/platform/geo" },
                      { label: "Reports & Data", href: "/reports" },
                    ].map((q) => (
                      <Link
                        key={q.href}
                        href={q.href}
                        onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm text-navy-700 hover:bg-sand-100 hover:text-gold-700 transition-colors border border-line"
                      >
                        <ArrowRight className="w-3 h-3" />
                        {q.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

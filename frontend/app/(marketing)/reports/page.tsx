"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  ExternalLink,
  FileText,
  Globe2,
} from "lucide-react";
import { Card, CardBody, Eyebrow, Section, SerifHeading } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/LocaleProvider";

// Sourced from the Ministry of Investment website API
// (https://website-api.investuae.gov.ae/api/v1/data/en/open-data?page=1).
// Every download_url was independently verified to return application/pdf
// payloads ranging from 700 KB to 20 MB. The titles, sub-titles, and
// originating ministry are taken verbatim from that API so this page stays
// in sync with the canonical source. Titles are proper names of Ministry
// PDFs and MUST remain in English regardless of locale.
const OFFICIAL_REPORTS = [
  {
    title: "From Capital Exporter to Financial Architect",
    sub: "The UAE's evolving role in global finance. Ministry of Investment whitepaper.",
    accent: "Whitepaper",
    issuer: "Ministry of Investment",
    url: "https://www.investuae.gov.ae/storage/post/XT4LDKirP8soRIAaec0qihUeIP51sboLCiq2W2bS.pdf",
  },
  {
    title: "UAE Foreign Direct Investment Report 2025",
    sub: "Comprehensive analysis of FDI flows, sector breakdowns and strategic positioning.",
    accent: "FDI Report",
    issuer: "Ministry of Investment",
    url: "https://www.investuae.gov.ae/storage/post/NcePRaoQIwHbjBGRX8RbVyDVbJtgGwRqDqIASDd4.pdf",
  },
  {
    title: "UAE Investment Ecosystem Whitepaper",
    sub: "Landscape brief tracking the UAE's rise as a destination for global capital.",
    accent: "Whitepaper",
    issuer: "Ministry of Investment",
    url: "https://www.investuae.gov.ae/storage/post/O72Lxbz6m6upUNeXkG9eKGSOCwTP1GROLlA3jWKy.pdf",
  },
  {
    title: "UAE Foreign Direct Investment Report 2024",
    sub: "Historical FDI data, trends, sector performance and policy outlook.",
    accent: "FDI Report",
    issuer: "Ministry of Investment",
    url: "https://www.investuae.gov.ae/storage/post/VBtzhMpCkrviEdncFl7bMYWcOYsyFJ1UTK4S55HK.pdf",
  },
  {
    title: "Climate Finance Report: COP28 UAE",
    sub: "UAE climate-finance commitments and ecosystem context published around COP28.",
    accent: "Climate Report",
    issuer: "Ministry of Finance",
    url: "https://www.investuae.gov.ae/storage/post/rtU4FUKKxtx8qslO7DrO8FS0hSmytykH6Mc5hGNo.pdf",
  },
  {
    title: "UAE Cultural & Creative Industries Pulse Check",
    sub: "Resilience and recovery of the UAE's creative economy through the pandemic.",
    accent: "Sector Brief",
    issuer: "Ministry of Culture & Youth",
    url: "https://www.investuae.gov.ae/storage/post/OQYokDHADsK258bcwBLIohcXrCK32COaS4sP3DKN.pdf",
  },
  {
    title: "Annual Economic Report 2021 (29th Edition)",
    sub: "Macroeconomic indicators, GDP contribution by sector, and trade balance analysis.",
    accent: "Economic Report",
    issuer: "Ministry of Economy",
    url: "https://www.investuae.gov.ae/storage/post/fxXRc6kA2IEcYTfA9ohtF1nzG5HRdrqqcCA6IZov.pdf",
  },
  {
    title: "Achievements Report 2022",
    sub: "Industrial development milestones and advanced-technology investment programmes.",
    accent: "Annual Report",
    issuer: "Ministry of Industry & Advanced Technology",
    url: "https://www.investuae.gov.ae/storage/post/VirYzM2OoqfYNlqwL081WFBU80KqBc7r85v0Tv2q.pdf",
  },
  {
    title: "UAE Sustainable Finance Framework 2021–2031",
    sub: "Decade-long roadmap for green capital, ESG disclosure and sustainable instruments.",
    accent: "Policy Framework",
    issuer: "Ministry of Climate Change & Environment",
    url: "https://www.investuae.gov.ae/storage/post/bJjTDCCUWudGDyyAQAgt3kWLdBDJd51eDV3hme7R.pdf",
  },
  {
    title: "UAE Statistical Annual Report 2020",
    sub: "Population, healthcare and demographic statistics across the UAE.",
    accent: "Statistical Report",
    issuer: "Ministry of Health & Prevention",
    url: "https://www.investuae.gov.ae/storage/post/kSNFzrsUpFkQmO71SSVGC815AzfYyP5l5b9aKoxj.pdf",
  },
  {
    title: "UAE State of Energy Report 2022",
    sub: "Energy mix, infrastructure investment and decarbonisation programme of record.",
    accent: "Energy Report",
    issuer: "Ministry of Energy & Infrastructure",
    url: "https://www.investuae.gov.ae/storage/post/bFgJah6XaTtGv9Tmb8ASyMC3LVcaqmEWTKKATEHv.pdf",
  },
  {
    title: "UAE Foreign Aid Report 2022",
    sub: "Overseas development assistance, humanitarian commitments and donor footprint.",
    accent: "Foreign Aid",
    issuer: "Ministry of Foreign Affairs",
    url: "https://www.investuae.gov.ae/storage/post/pk94du2jxAdInIJksGILZ2LVe3rYXb3qW0KHQBRL.pdf",
  },
];

const PAGE_SIZE = 6;

const DATA_SOURCES = [
  {
    Icon: Globe2,
    title: "Invest UAE Portal",
    desc: "The official platform by the Ministry of Investment dedicated to enhancing the UAE's investment ecosystem.",
    url: "https://www.investuae.gov.ae",
  },
  {
    Icon: Database,
    title: "UAE Open Data Platform",
    desc: "Official UAE government open data portal with datasets on economy, trade, demographics and sectors.",
    url: "https://opendata.fcsc.gov.ae",
  },
  {
    Icon: Database,
    title: "ADGM Data",
    desc: "Abu Dhabi Global Market regulatory data, licensed entities, and financial services ecosystem.",
    url: "https://www.adgm.com",
  },
  {
    Icon: Database,
    title: "DIFC Open Data",
    desc: "Dubai International Financial Centre data on registered entities, sectors and financial activity.",
    url: "https://www.difc.ae",
  },
];

export default function ReportsPage() {
  return (
    <Suspense fallback={null}>
      <ReportsPageInner />
    </Suspense>
  );
}

function ReportsPageInner() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const pageParam = searchParams?.get("page") ?? "1";
  const totalPages = Math.max(1, Math.ceil(OFFICIAL_REPORTS.length / PAGE_SIZE));
  const requested = Number.parseInt(pageParam, 10);
  const page = Number.isFinite(requested)
    ? Math.min(Math.max(1, requested), totalPages)
    : 1;
  const start = (page - 1) * PAGE_SIZE;
  const visible = OFFICIAL_REPORTS.slice(start, start + PAGE_SIZE);
  const showingFrom = start + 1;
  const showingTo = start + visible.length;

  const showingLabel = t("reports.showing")
    .replace("{from}", String(showingFrom))
    .replace("{to}", String(showingTo))
    .replace("{total}", String(OFFICIAL_REPORTS.length));

  return (
    <>
      <Section className="pt-10 md:pt-16 pb-8 md:pb-10 max-w-5xl">
        <Eyebrow>{t("reports.eyebrow")}</Eyebrow>
        <SerifHeading level={1} className="mt-4">
          {t("reports.title")}
        </SerifHeading>
        <p className="mt-4 text-base md:text-lg text-ink-500 max-w-2xl">
          {t("reports.subtitle")}
        </p>
      </Section>

      <Section className="pb-12 md:pb-16">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <Eyebrow>{t("reports.section.publications")}</Eyebrow>
          <span className="text-xs text-ink-500">{showingLabel}</span>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {visible.map((r) => (
            <Card key={r.url}>
              <CardBody className="p-5 md:p-8 flex flex-col h-full">
                <div className="flex items-start justify-between mb-4 md:mb-6">
                  <FileText className="w-6 h-6 md:w-7 md:h-7 text-gold-600" />
                  <span className="text-[10px] uppercase tracking-[0.24em] text-ink-400 text-right">
                    {r.accent}
                  </span>
                </div>
                <h3 className="headline-serif text-navy-800 text-lg md:text-xl tracking-tight leading-snug">
                  {r.title}
                </h3>
                <p className="mt-2 md:mt-3 text-sm text-ink-500 leading-relaxed flex-1">
                  {r.sub}
                </p>
                <div className="mt-4 md:mt-6 flex items-center justify-between gap-3 text-xs text-ink-400">
                  <span className="truncate">{r.issuer}</span>
                  <span className="shrink-0">{t("reports.fileType.pdf")}</span>
                </div>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 md:mt-4 inline-flex items-center gap-2 text-sm font-medium text-navy-700 hover:text-gold-600 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  {t("reports.viewReport")}
                </a>
                <a
                  href={r.url}
                  download
                  className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-gold-600 hover:text-gold-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  {t("reports.downloadPdf")}
                </a>
              </CardBody>
            </Card>
          ))}
        </div>

        {totalPages > 1 && (
          <Pagination currentPage={page} totalPages={totalPages} />
        )}
      </Section>

      <Section className="pb-16 md:pb-24">
        <Eyebrow>{t("reports.section.dataSources")}</Eyebrow>
        <h2 className="headline-serif text-navy-800 text-2xl md:text-3xl mt-4 mb-6 md:mb-8">
          {t("reports.dataSources.title")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {DATA_SOURCES.map((s) => (
            <a
              key={s.title}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="surface-card p-5 md:p-6 flex items-start gap-4 md:gap-5 group"
            >
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-line bg-sand-100 flex items-center justify-center flex-shrink-0">
                <s.Icon className="w-4 h-4 md:w-5 md:h-5 text-gold-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-navy-800 font-semibold group-hover:text-gold-700 transition-colors truncate">
                    {s.title}
                  </h3>
                  <ExternalLink className="w-3.5 h-3.5 text-ink-400 group-hover:text-gold-600 transition-colors shrink-0" />
                </div>
                <p className="mt-1.5 text-sm text-ink-500 leading-relaxed">{s.desc}</p>
              </div>
            </a>
          ))}
        </div>
      </Section>
    </>
  );
}

function Pagination({
  currentPage,
  totalPages,
}: {
  currentPage: number;
  totalPages: number;
}) {
  const { t } = useLocale();
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const prevHref = currentPage > 1 ? `/reports?page=${currentPage - 1}` : null;
  const nextHref =
    currentPage < totalPages ? `/reports?page=${currentPage + 1}` : null;

  const navBtn =
    "inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-[3px] border text-sm font-medium transition-colors";

  return (
    <nav
      aria-label={t("reports.pagination.aria")}
      className="mt-8 md:mt-10 flex items-center justify-between gap-3 flex-wrap"
    >
      {prevHref ? (
        <Link
          href={prevHref}
          scroll={false}
          className={cn(
            navBtn,
            "border-line bg-white text-navy-700 hover:border-navy-300",
          )}
        >
          <ChevronLeft className="w-4 h-4 rtl:-scale-x-100" />
          {t("reports.pagination.prev")}
        </Link>
      ) : (
        <span
          aria-hidden
          className={cn(navBtn, "border-line bg-sand-50 text-ink-400 cursor-not-allowed")}
        >
          <ChevronLeft className="w-4 h-4 rtl:-scale-x-100" />
          {t("reports.pagination.prev")}
        </span>
      )}

      <ol className="flex items-center gap-1.5">
        {pages.map((p) => {
          const isActive = p === currentPage;
          return (
            <li key={p}>
              <Link
                href={`/reports?page=${p}`}
                scroll={false}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex items-center justify-center min-w-[36px] h-9 px-2.5 rounded-[3px] text-sm font-medium border transition-colors",
                  isActive
                    ? "bg-navy-800 text-white border-navy-800"
                    : "bg-white text-navy-700 border-line hover:border-navy-300",
                )}
              >
                {p}
              </Link>
            </li>
          );
        })}
      </ol>

      {nextHref ? (
        <Link
          href={nextHref}
          scroll={false}
          className={cn(
            navBtn,
            "border-line bg-white text-navy-700 hover:border-navy-300",
          )}
        >
          {t("reports.pagination.next")}
          <ChevronRight className="w-4 h-4 rtl:-scale-x-100" />
        </Link>
      ) : (
        <span
          aria-hidden
          className={cn(navBtn, "border-line bg-sand-50 text-ink-400 cursor-not-allowed")}
        >
          {t("reports.pagination.next")}
          <ChevronRight className="w-4 h-4 rtl:-scale-x-100" />
        </span>
      )}
    </nav>
  );
}

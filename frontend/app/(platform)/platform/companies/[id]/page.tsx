import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  MapPin,
  Building2,
  ChevronRight,
  Sparkles,
  ShieldAlert,
  Compass,
} from "lucide-react";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { SignalCard } from "@/components/platform/SignalCard";
import { EmptyState } from "@/components/platform/EmptyState";
import { Card, CardBody, Badge, Eyebrow } from "@/components/ui/primitives";
import { ScorePill } from "@/components/ui/score-pill";
import { api } from "@/lib/api/client";
import { sectorLabel, formatUsd, relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CompanyDetail({ params }: PageProps) {
  const { id } = await params;

  let dossier;
  try {
    dossier = await api.company(id);
  } catch (e) {
    return (
      <PlatformShell
        title="Company not in current pipeline"
        subtitle="This dossier link is stale. The company is no longer in the latest pipeline snapshot."
      >
        <div className="mb-6">
          <Link
            href="/platform/companies"
            className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-navy-800"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to pipeline
          </Link>
        </div>
        <EmptyState
          title="Dossier unavailable"
          body="Company IDs are derived from the pipeline run that produced them. After a refresh, some entries may be merged, renamed, or dropped. Open the pipeline list to find the current entry."
        />
      </PlatformShell>
    );
  }

  const { company, investment_thesis, risks, next_actions, related_signals } = dossier;
  const composite = (company.investability_score + company.uae_alignment_score) / 2;

  return (
    <PlatformShell
      title={company.name}
      subtitle={company.description ?? "Full investment dossier and signal analysis"}
    >
      <div className="mb-6">
        <Link
          href="/platform/companies"
          className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-navy-800"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to pipeline
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column */}
        <aside className="lg:col-span-4 space-y-6">
          <Card>
            <CardBody className="p-6">
              <Eyebrow>Composite Score</Eyebrow>
              <div className="mt-4 flex items-end gap-2">
                <span className="headline-serif text-6xl text-navy-800 leading-none">
                  {Math.round(composite)}
                </span>
                <span className="text-ink-400 text-sm pb-2">/ 100</span>
              </div>
              <div className="mt-6 space-y-4">
                <ScoreBar
                  label="Investability"
                  value={company.investability_score}
                />
                <ScoreBar
                  label="UAE Alignment"
                  value={company.uae_alignment_score}
                />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="p-6 space-y-4 text-sm">
              <Eyebrow>Company Facts</Eyebrow>
              {company.headquarters && (
                <Fact
                  Icon={MapPin}
                  label="Headquarters"
                  value={`${company.headquarters.city ?? ""}${
                    company.headquarters.city ? ", " : ""
                  }${company.headquarters.country ?? ""}`}
                />
              )}
              {company.expansion_targets.length > 0 && (
                <Fact
                  Icon={Compass}
                  label="Stated expansion targets"
                  value={company.expansion_targets
                    .map((t) =>
                      t.city ? `${t.city}, ${t.country ?? ""}` : t.country ?? "",
                    )
                    .filter(Boolean)
                    .join(" · ")}
                />
              )}
              {company.last_funding_usd != null && (
                <Fact
                  Icon={Building2}
                  label="Last funding"
                  value={formatUsd(company.last_funding_usd)}
                />
              )}
              {company.aliases.length > 0 && (
                <Fact
                  Icon={Sparkles}
                  label="Also known as"
                  value={company.aliases.join(", ")}
                />
              )}
              <Fact
                Icon={Sparkles}
                label="Signals detected"
                value={`${company.signals.length} over ${relativeTime(
                  company.first_seen,
                )}`}
              />
            </CardBody>
          </Card>

          <Card>
            <CardBody className="p-6">
              <Eyebrow>Sectors</Eyebrow>
              <div className="mt-4 flex flex-wrap gap-2">
                {company.sectors.map((s) => (
                  <Badge key={s} tone="gold">
                    {sectorLabel(s)}
                  </Badge>
                ))}
              </div>
            </CardBody>
          </Card>
        </aside>

        {/* Right column */}
        <section className="lg:col-span-8 space-y-6">
          <Card>
            <CardBody className="p-8">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-gold-600" />
                <Eyebrow>Investment Thesis</Eyebrow>
              </div>
              <h2 className="headline-serif text-navy-800 text-2xl mt-4 leading-relaxed">
                {investment_thesis ||
                  "Thesis pending. Refresh the pipeline to generate analysis."}
              </h2>
            </CardBody>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardBody className="p-6">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <Eyebrow>Key Risks</Eyebrow>
                </div>
                <ul className="mt-4 space-y-3">
                  {(risks.length ? risks : ["No specific risks flagged."]).map(
                    (r, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-ink-700">
                        <ChevronRight className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        <span className="leading-relaxed">{r}</span>
                      </li>
                    ),
                  )}
                </ul>
              </CardBody>
            </Card>

            <Card>
              <CardBody className="p-6">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-emerald-600" />
                  <Eyebrow>Recommended Actions</Eyebrow>
                </div>
                <ul className="mt-4 space-y-3">
                  {(next_actions.length
                    ? next_actions
                    : ["No actions recommended yet."]).map((a, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-ink-700">
                      <ChevronRight className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span className="leading-relaxed">{a}</span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </div>

          {/* Signal timeline */}
          <Card>
            <CardBody className="p-8">
              <Eyebrow>Signal Timeline · {company.signals.length}</Eyebrow>
              <div className="mt-6 space-y-5">
                {company.signals.map((s) => (
                  <div
                    key={s.id}
                    className="border-l-2 border-line pl-5 hover:border-gold-500 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-ink-400 font-medium">
                      <span>{relativeTime(s.detected_at)}</span>
                      <span className="opacity-30">·</span>
                      <span>{s.type.replace("_", " ")}</span>
                      <span className="opacity-30">·</span>
                      <span>{s.strength} signal</span>
                    </div>
                    <h4 className="headline-serif text-navy-800 text-lg mt-1.5 leading-snug">
                      {s.headline}
                    </h4>
                    <p className="mt-1.5 text-sm text-ink-500 leading-relaxed">
                      {s.rationale}
                    </p>
                    <a
                      href={s.source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 text-xs text-navy-700 hover:text-gold-600 font-medium"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {s.source.source_name} · {s.source.source_region}
                    </a>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Related */}
          {related_signals.length > 0 && (
            <Card>
              <CardBody className="p-6">
                <Eyebrow>Related Sector Signals</Eyebrow>
                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {related_signals.map((s) => (
                    <SignalCard key={s.id} signal={s} />
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
        </section>
      </div>
    </PlatformShell>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-ink-500">{label}</span>
        <ScorePill score={value} />
      </div>
      <div className="h-1.5 bg-sand-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-gold-500 to-gold-400"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Fact({
  Icon,
  label,
  value,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-ink-400 mt-0.5 flex-shrink-0" />
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-ink-400 font-medium">
          {label}
        </div>
        <div className="text-sm text-navy-800 mt-0.5 leading-snug">{value}</div>
      </div>
    </div>
  );
}

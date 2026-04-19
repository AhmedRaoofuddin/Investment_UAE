import Link from "next/link";
import { Radar } from "lucide-react";

export function EmptyState({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: { label: string; href?: string; onClick?: () => void };
}) {
  return (
    <div className="surface-card p-16 text-center">
      <div className="inline-flex w-14 h-14 rounded-full bg-sand-200 items-center justify-center mb-6">
        <Radar className="w-6 h-6 text-navy-600" />
      </div>
      <h3 className="headline-serif text-navy-800 text-2xl mb-3">{title}</h3>
      <p className="text-ink-500 max-w-md mx-auto leading-relaxed">{body}</p>
      {cta && (
        cta.href ? (
          <Link href={cta.href} className="mt-6 inline-flex btn-primary text-sm">
            {cta.label}
          </Link>
        ) : (
          <button onClick={cta.onClick} className="mt-6 inline-flex btn-primary text-sm">
            {cta.label}
          </button>
        )
      )}
    </div>
  );
}

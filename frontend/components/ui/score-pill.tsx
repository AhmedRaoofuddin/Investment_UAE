import { cn } from "@/lib/utils";

export function ScorePill({
  score,
  label,
  className,
}: {
  score: number;
  label?: string;
  className?: string;
}) {
  let tone = "score-low";
  if (score >= 70) tone = "score-high";
  else if (score >= 45) tone = "score-med";
  return (
    <span className={cn("score-pill", tone, className)}>
      {label && <span className="opacity-70">{label}</span>}
      <span>{Math.round(score)}</span>
    </span>
  );
}

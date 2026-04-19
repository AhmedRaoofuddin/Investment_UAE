import Image from "next/image";
import { cn } from "@/lib/utils";

// The official Invest UAE / Ministry of Investment dual logo, fetched verbatim
// from https://www.investuae.gov.ae. Native viewBox is 989.45 × 482.5 (~2.05:1).
//
// We ship a single source asset and tint it for dark backgrounds via a CSS
// filter rather than maintaining a second hand-edited SVG, because the artwork
// uses ~25 distinct colours (UAE red, gold, navy, several greys) and any
// per-channel inversion would produce an unreadable result.
const LOGO_SRC = "/brand/dual-logo-official.svg";

export function Logo({
  variant = "dark",
  className,
}: {
  // "dark"  → original colours, for use on light backgrounds (header)
  // "light" → flattened to pure white, for use on dark backgrounds (footer)
  variant?: "dark" | "light";
  className?: string;
}) {
  return (
    <div className={cn("inline-block", className)}>
      <Image
        src={LOGO_SRC}
        alt="Invest UAE | Ministry of Investment"
        width={989}
        height={482}
        priority
        className={cn(
          // Responsive sizing: smaller on phones, fuller on desktop.
          "h-10 sm:h-12 lg:h-14 w-auto",
          variant === "light" && "brightness-0 invert",
        )}
      />
    </div>
  );
}

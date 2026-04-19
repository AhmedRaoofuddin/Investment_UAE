import * as React from "react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────
// Button
// ─────────────────────────────────────────────────────────────────
type ButtonVariant = "primary" | "outline" | "ghost" | "navy";
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-gold-500 text-navy-900 hover:bg-gold-400",
    outline:
      "bg-transparent text-navy-800 border border-navy-800 hover:bg-navy-800 hover:text-white",
    ghost: "bg-transparent text-navy-700 hover:bg-navy-50",
    navy: "bg-navy-800 text-white hover:bg-navy-700",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-5 py-2.5 text-sm",
    lg: "px-7 py-3.5 text-base",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[3px] font-medium tracking-wide transition-all duration-200 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}

// ─────────────────────────────────────────────────────────────────
// Card
// ─────────────────────────────────────────────────────────────────
export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "surface-card overflow-hidden",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 border-b border-line", className)} {...props} />;
}

export function CardBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

// ─────────────────────────────────────────────────────────────────
// Badge
// ─────────────────────────────────────────────────────────────────
export function Badge({
  className,
  tone = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "default" | "navy" | "gold" | "success" | "warning" | "danger";
}) {
  const tones = {
    default: "bg-sand-200 text-ink-700 border border-line",
    navy: "bg-navy-50 text-navy-800 border border-navy-100",
    gold: "bg-gold-50 text-gold-700 border border-gold-100",
    success: "bg-emerald-50 text-emerald-700 border border-emerald-100",
    warning: "bg-amber-50 text-amber-700 border border-amber-100",
    danger: "bg-rose-50 text-rose-700 border border-rose-100",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

// ─────────────────────────────────────────────────────────────────
// Section
// ─────────────────────────────────────────────────────────────────
export function Section({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn("max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10", className)}
      {...props}
    >
      {children}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// Eyebrow + serif Heading helper
// ─────────────────────────────────────────────────────────────────
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("eyebrow", className)}>{children}</span>;
}

export function SerifHeading({
  level = 2,
  className,
  children,
}: {
  level?: 1 | 2 | 3;
  className?: string;
  children: React.ReactNode;
}) {
  const Tag = (`h${level}` as keyof React.JSX.IntrinsicElements);
  const sizes = {
    1: "text-4xl md:text-6xl",
    2: "text-3xl md:text-5xl",
    3: "text-2xl md:text-3xl",
  };
  return (
    <Tag className={cn("headline-serif text-navy-800", sizes[level], className)}>
      {children}
    </Tag>
  );
}

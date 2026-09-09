import Link from "next/link";
import { cn } from "@/lib/utils";
import type { StatusTone } from "@/lib/status";
import { toneText } from "@/lib/status";

/**
 * Readouts.
 *
 * The brief against the old design was six identical KPI cards, so the system
 * here is deliberately unequal: `MetricStrip` is the dense supporting row,
 * `StatusHeadline` is the one large reading a page is allowed, and `MetricCell`
 * is what fills the strip. Hierarchy comes from which one you choose, not from
 * decorating them differently.
 */

/* -------------------------------------------------------------------------- */
/* MetricStrip                                                                */
/* -------------------------------------------------------------------------- */

/**
 * One panel, hairline-divided cells. Never six bordered cards with their own
 * shadows — a strip reads as a single instrument.
 */
export function MetricStrip({
  children,
  className,
}: Readonly<{ children: React.ReactNode; className?: string }>) {
  return (
    <div
      className={cn(
        "panel-flush grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
        "[&>*]:border-b [&>*]:border-r [&>*]:border-[var(--line-soft)]",
        "[&>*:nth-child(2n)]:border-r-0 sm:[&>*:nth-child(2n)]:border-r sm:[&>*:nth-child(3n)]:border-r-0",
        "lg:[&>*]:border-b-0 lg:[&>*:nth-child(3n)]:border-r lg:[&>*:last-child]:border-r-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Variant sized for four readings rather than six. */
export function MetricStrip4({
  children,
  className,
}: Readonly<{ children: React.ReactNode; className?: string }>) {
  return (
    <div
      className={cn(
        "panel-flush grid grid-cols-2 lg:grid-cols-4",
        "[&>*]:border-b [&>*]:border-r [&>*]:border-[var(--line-soft)]",
        "[&>*:nth-child(2n)]:border-r-0",
        "lg:[&>*]:border-b-0 lg:[&>*:nth-child(2n)]:border-r lg:[&>*:last-child]:border-r-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* MetricCell                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * One reading inside a strip. When `href` is set the whole cell becomes a link
 * — an operator who sees "3 tamper alerts" should be able to act on it from
 * where they read it, not hunt for the route in the sidebar.
 */
export function MetricCell({
  label,
  value,
  unit,
  caption,
  tone,
  href,
  className,
}: Readonly<{
  label: string;
  value: React.ReactNode;
  unit?: string;
  caption?: React.ReactNode;
  tone?: StatusTone;
  href?: string;
  className?: string;
}>) {
  const body = (
    <>
      <p className="t-label">{label}</p>
      <p className="mt-1.5 flex items-baseline gap-1.5">
        <span className={cn("t-metric", tone ? toneText[tone] : undefined)}>{value}</span>
        {unit ? <span className="text-[11px] font-medium text-[var(--text-4)]">{unit}</span> : null}
      </p>
      {caption ? <p className="mt-1 text-[11px] leading-snug text-[var(--text-3)]">{caption}</p> : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          "min-w-0 px-3.5 py-3 transition-colors duration-[var(--t-fast)] hover:bg-[var(--panel-header)]",
          className,
        )}
      >
        {body}
      </Link>
    );
  }

  return <div className={cn("min-w-0 px-3.5 py-3", className)}>{body}</div>;
}

/* -------------------------------------------------------------------------- */
/* StatusHeadline                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The single most important statement on a page: is this thing all right?
 *
 * It answers with a word before it answers with a number, because that is the
 * order an operator actually reads in — "Attention required", then how many,
 * then which ones.
 */
export function StatusHeadline({
  state,
  headline,
  detail,
  tone,
  aside,
  className,
}: Readonly<{
  /** Small caps caption above the verdict — e.g. "Road network status". */
  state: string;
  headline: string;
  detail?: React.ReactNode;
  tone: StatusTone;
  aside?: React.ReactNode;
  className?: string;
}>) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-x-8 gap-y-4", className)}>
      <div className="min-w-0">
        <p className="t-label">{state}</p>
        <p className="mt-1.5 flex items-center gap-2.5">
          <span
            aria-hidden
            className="dot h-2.5 w-2.5"
            data-status={tone}
          />
          <span className={cn("text-[22px] font-semibold leading-none tracking-[-0.02em]", toneText[tone])}>
            {headline}
          </span>
        </p>
        {detail ? <p className="mt-2 max-w-xl text-[12px] leading-relaxed text-[var(--text-3)]">{detail}</p> : null}
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Readout                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A single labelled number in a row of them. Lighter than a MetricCell — used
 * inside panel headers and detail drawers where a full strip would be too much.
 */
export function Readout({
  label,
  value,
  unit,
  tone,
  size = "md",
  className,
}: Readonly<{
  label: string;
  value: React.ReactNode;
  unit?: string;
  tone?: StatusTone;
  size?: "sm" | "md" | "lg";
  className?: string;
}>) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="t-label">{label}</p>
      <p className="mt-1 flex items-baseline gap-1">
        <span
          className={cn(
            "t-num font-semibold leading-none",
            size === "sm" && "text-[13px]",
            size === "md" && "text-[17px] tracking-[-0.02em]",
            size === "lg" && "text-[28px] tracking-[-0.028em]",
            tone ? toneText[tone] : "text-[var(--text)]",
          )}
        >
          {value}
        </span>
        {unit ? <span className="text-[10.5px] font-medium text-[var(--text-4)]">{unit}</span> : null}
      </p>
    </div>
  );
}

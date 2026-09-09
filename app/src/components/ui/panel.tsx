import { cn } from "@/lib/utils";
import type { StatusTone } from "@/lib/status";
import { toneText } from "@/lib/status";

/**
 * The single container primitive. Everything that needs a frame is a Panel, so
 * border, radius and header geometry never drift between routes.
 *
 * Panels are defined by a hairline, not by a shadow: in a dense operational
 * layout, elevation on every card turns the workspace into noise. Shadows are
 * reserved for surfaces that genuinely float — dropdowns, drawers, map controls.
 */
export function Panel({
  tone,
  className,
  children,
  ...rest
}: Readonly<{
  /** Applies a status edge. Only when the *whole* panel is in that state. */
  tone?: "crit" | "warn" | "ok" | "tamper" | "active";
  className?: string;
  children: React.ReactNode;
}> &
  React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "panel-flush flex min-w-0 flex-col",
        tone === "crit" && "panel-crit",
        tone === "warn" && "panel-warn",
        tone === "ok" && "panel-ok",
        tone === "tamper" && "panel-tamper",
        tone === "active" && "panel-active",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/**
 * A panel's header strip. Title on the left, controls on the right, one fixed
 * height so a row of panels aligns across the grid.
 */
export function PanelHead({
  title,
  meta,
  actions,
  icon,
  className,
}: Readonly<{
  title: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}>) {
  return (
    <div className={cn("panel-head shrink-0", className)}>
      <div className="flex min-w-0 items-center gap-2">
        {icon ? <span className="flex-none text-[var(--text-4)]">{icon}</span> : null}
        <h3 className="t-panel-title truncate">{title}</h3>
        {meta ? <span className="t-meta truncate text-[var(--text-4)]">{meta}</span> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
    </div>
  );
}

/** Panel body with the standard inset. `pad="none"` for tables and maps. */
export function PanelBody({
  pad = "md",
  scroll = false,
  className,
  children,
}: Readonly<{
  pad?: "none" | "sm" | "md" | "lg";
  scroll?: boolean;
  className?: string;
  children: React.ReactNode;
}>) {
  return (
    <div
      className={cn(
        "min-h-0 min-w-0",
        scroll && "flex-1 overflow-y-auto",
        pad === "sm" && "p-2.5",
        pad === "md" && "p-3.5",
        pad === "lg" && "p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Field — the label/value workhorse                                          */
/* -------------------------------------------------------------------------- */

/**
 * A label/value pair. Used in every detail view. The label is small caps above
 * the value, so a grid of these reads as a specification sheet rather than as
 * a form.
 */
export function Field({
  label,
  value,
  tone,
  mono = false,
  hint,
  className,
}: Readonly<{
  label: string;
  value: React.ReactNode;
  tone?: StatusTone;
  mono?: boolean;
  hint?: string;
  className?: string;
}>) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="t-label">{label}</p>
      <p
        className={cn(
          "mt-1 break-words font-medium",
          mono ? "t-mono" : "t-num text-[12.5px]",
          tone ? toneText[tone] : "text-[var(--text)]",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[10.5px] leading-tight text-[var(--text-4)]">{hint}</p> : null}
    </div>
  );
}

/** A grid of Fields. Columns collapse rather than reflow into cards. */
export function FieldGrid({
  columns = 4,
  className,
  children,
}: Readonly<{ columns?: 2 | 3 | 4 | 5 | 6; className?: string; children: React.ReactNode }>) {
  const cols = {
    2: "grid-cols-2",
    3: "grid-cols-2 sm:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
    6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
  }[columns];
  return <div className={cn("grid gap-x-4 gap-y-3.5", cols, className)}>{children}</div>;
}

/* -------------------------------------------------------------------------- */
/* Section — structural grouping inside a page                                */
/* -------------------------------------------------------------------------- */

/**
 * Groups panels under a labelled rule. Replaces the old numbered marketing
 * section headers — this is a quiet caption, not a chapter title.
 */
export function Section({
  title,
  description,
  actions,
  className,
  children,
}: Readonly<{
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}>) {
  return (
    <section className={cn("min-w-0", className)}>
      {title ? (
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div className="flex min-w-0 items-baseline gap-2.5">
            <h2 className="t-section">{title}</h2>
            {description ? <p className="t-meta truncate text-[var(--text-4)]">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

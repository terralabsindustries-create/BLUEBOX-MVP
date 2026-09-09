import { cn } from "@/lib/utils";

/**
 * Every route opens with this bar.
 *
 * It is a chrome strip, not a title screen: one line of identity, one line of
 * purpose, controls on the right, roughly 56px tall. The previous 76px display
 * headline consumed a third of a 768px-high operator display before any data
 * appeared, which is the wrong trade in a control room.
 */
export function PageHeader({
  group,
  title,
  description,
  actions,
  status,
  className,
}: Readonly<{
  /** The navigation group this route belongs to — Operations, Enforcement… */
  group: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** Live state for this route: counts, verification totals, link health. */
  status?: React.ReactNode;
  className?: string;
}>) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-[var(--line)] bg-[var(--panel)] px-4 py-2.5",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0">
          <p className="t-page-label">{group}</p>
          <h1 className="t-page-title mt-0.5 truncate">{title}</h1>
        </div>
        {description ? (
          <>
            <span aria-hidden className="hidden h-7 w-px shrink-0 bg-[var(--line)] lg:block" />
            <p className="t-page-desc hidden max-w-md lg:block">{description}</p>
          </>
        ) : null}
      </div>

      {status || actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
          {status ? <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">{status}</div> : null}
          {actions ? <div className="flex flex-wrap items-center gap-1.5">{actions}</div> : null}
        </div>
      ) : null}
    </header>
  );
}

/**
 * A compact readout for the header's status area: a caption above a value.
 * Reads as instrumentation rather than as another badge.
 */
export function HeaderStat({
  label,
  value,
  tone,
}: Readonly<{ label: string; value: React.ReactNode; tone?: "default" | "crit" | "warn" | "ok" }>) {
  return (
    <div className="min-w-0">
      <p className="t-label leading-none">{label}</p>
      <p
        className={cn(
          "t-num mt-1 text-[14px] font-semibold leading-none",
          tone === "crit" && "text-[var(--crit-text)]",
          tone === "warn" && "text-[var(--warn-text)]",
          tone === "ok" && "text-[var(--ok-text)]",
          (!tone || tone === "default") && "text-[var(--text)]",
        )}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * Standard page frame: a header bar, then a scrolling workspace beneath it.
 * `flush` hands the whole area to the child (used by Map & Heatmap, where the
 * map itself is the page).
 */
export function PageBody({
  flush = false,
  className,
  children,
}: Readonly<{ flush?: boolean; className?: string; children: React.ReactNode }>) {
  return (
    <div
      className={cn(
        "min-h-0 flex-1",
        flush ? "overflow-hidden" : "space-y-3 overflow-y-auto p-3.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The page shell: header on top, body below, both inside one flex column. */
export function Page({ className, children }: Readonly<{ className?: string; children: React.ReactNode }>) {
  return <div className={cn("flex h-full min-h-0 flex-col", className)}>{children}</div>;
}

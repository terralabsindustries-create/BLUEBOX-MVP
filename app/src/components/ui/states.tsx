import { cn } from "@/lib/utils";
import type { StatusTone } from "@/lib/status";
import { StatusDot } from "@/components/ui/status";

/**
 * System states.
 *
 * A control room screen with nothing on it is a claim: "there is nothing here."
 * That claim has to look deliberate and has to say *why*, or an operator will
 * read it as a broken screen and stop trusting the view. So every empty state
 * names the condition and, where one exists, offers the action that changes it.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = "idle",
  compact = false,
  className,
}: Readonly<{
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  tone?: StatusTone;
  compact?: boolean;
  className?: string;
}>) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "px-6 py-8" : "px-6 py-14",
        className,
      )}
    >
      {icon ? (
        <div
          className="mb-3 grid h-9 w-9 place-items-center rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--panel-sunken)] text-[var(--text-4)]"
          data-tone={tone}
        >
          {icon}
        </div>
      ) : null}
      <p className="text-[13px] font-semibold text-[var(--text-2)]">{title}</p>
      {description ? (
        <p className="mt-1 max-w-xs text-[11.5px] leading-relaxed text-[var(--text-4)]">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/**
 * A named operating condition rather than an absence — "Bridge disconnected",
 * "Map tiles unavailable". Carries a status edge because the condition itself
 * is information the operator needs.
 */
export function ConditionState({
  tone,
  title,
  description,
  action,
  className,
}: Readonly<{
  tone: StatusTone;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}>) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-l-[3px] px-3.5 py-2.5",
        tone === "crit" && "border-l-[var(--crit)] bg-[var(--crit-dim)]",
        tone === "warn" && "border-l-[var(--warn)] bg-[var(--warn-dim)]",
        tone === "ok" && "border-l-[var(--ok)] bg-[var(--ok-dim)]",
        tone === "info" && "border-l-[var(--info)] bg-[var(--info-dim)]",
        tone === "tamper" && "border-l-[var(--tamper)] bg-[var(--tamper-dim)]",
        tone === "brand" && "border-l-[var(--brand)] bg-[var(--brand-dim)]",
        tone === "idle" && "border-l-[var(--idle)] bg-[var(--idle-dim)]",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <StatusDot tone={tone} className="mt-1.5" />
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold text-[var(--text)]">{title}</p>
          {description ? <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--text-2)]">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/**
 * Placeholder for a client-only surface that is still mounting (the map, a
 * chart). Restrained on purpose: this application is local and offline-first,
 * so almost nothing genuinely loads, and a skeleton everywhere would invent
 * latency the product does not have.
 */
export function LoadingState({ label, className }: Readonly<{ label: string; className?: string }>) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex h-full w-full flex-col items-center justify-center gap-2.5 bg-[var(--panel-sunken)]", className)}
    >
      <span className="progress-indeterminate w-32" />
      <p className="t-label">{label}</p>
    </div>
  );
}

/** Retained alias for the map's dynamic-import fallback. */
export const LoadingSurface = LoadingState;

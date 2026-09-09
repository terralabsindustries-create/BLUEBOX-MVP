"use client";

import { speedRule } from "@/lib/rules/speed-rule";
import { useJurisdiction } from "@/lib/use-jurisdiction";
import { cn } from "@/lib/utils";
import { type StatusTone, toneVar } from "@/lib/status";

/**
 * THE RULE, MADE VISIBLE
 *
 * BlueBox's enforcement logic is its most important claim and its least
 * obvious one: a violation is not "went over the limit". It is
 *
 *     speed > limit + tolerance, sustained for a minimum duration,
 *     with a valid GNSS fix
 *
 * — which is precisely the design that stops a two-second GPS spike becoming a
 * penalty. Stakeholders do not believe that from a sentence; they believe it
 * from watching a bar fill and a speed drop and the event *not* be created.
 * These components exist to make the rule watchable.
 *
 * None of them change the rule. They read `speedRule` and render it.
 */

/** Where a reading sits relative to the rule's bands. */
export function speedTone(kph: number, limit: number, tolerance: number): StatusTone {
  const trigger = limit + tolerance;
  if (kph > trigger * 1.35) return "crit";
  if (kph > trigger) return "crit";
  if (kph > limit) return "warn";
  return "ok";
}

/**
 * The threshold scale.
 *
 * A single axis showing normal / limit / trigger / critical, with the current
 * reading marked on it. This answers "how bad is this?" without the reader
 * doing arithmetic — the gap between the marker and the trigger line *is* the
 * answer.
 */
export function SpeedRuleScale({
  speed,
  limit = speedRule.defaultRoadLimit,
  tolerance = speedRule.tolerance,
  max = 140,
  showLabels = true,
  className,
}: Readonly<{
  speed: number;
  limit?: number;
  tolerance?: number;
  max?: number;
  showLabels?: boolean;
  className?: string;
}>) {
  const j = useJurisdiction();
  const trigger = limit + tolerance;
  const pct = (value: number) => Math.min(100, Math.max(0, (value / max) * 100));
  const tone = speedTone(speed, limit, tolerance);

  return (
    <div className={cn("min-w-0", className)}>
      <div className="relative h-[7px] w-full overflow-hidden rounded-full bg-[var(--surface-3)]">
        {/* Bands: normal → tolerance → violation. Tolerance is drawn as its own
            band because it is the part of the rule people most often miss. */}
        <span className="absolute inset-y-0 left-0 bg-[var(--ok)] opacity-40" style={{ width: `${pct(limit)}%` }} />
        <span
          className="absolute inset-y-0 bg-[var(--warn)] opacity-40"
          style={{ left: `${pct(limit)}%`, width: `${pct(trigger) - pct(limit)}%` }}
        />
        <span
          className="absolute inset-y-0 right-0 bg-[var(--crit)] opacity-30"
          style={{ left: `${pct(trigger)}%` }}
        />

        {/* The current reading. */}
        <span
          className="absolute -top-[2px] h-[11px] w-[3px] rounded-full transition-[left] duration-[var(--t-slow)] ease-[var(--ease-out)]"
          style={{ left: `calc(${pct(speed)}% - 1.5px)`, background: toneVar[tone], boxShadow: "0 0 0 2px var(--panel)" }}
        />
      </div>

      {showLabels ? (
        // The limit and the trigger are only a tolerance apart — about 4% of
        // the scale — so their labels are staggered onto two rows rather than
        // colliding. The stagger is unconditional so the layout does not jump
        // when a road with a different tolerance is selected.
        <div className="relative mt-1 h-[34px]">
          <Tick position={0} label="0" />
          <Tick position={pct(limit)} label={String(j.speedValue(limit))} caption="Limit" tone="ok" />
          <Tick
            position={pct(trigger)}
            label={String(j.speedValue(trigger))}
            caption="Trigger"
            tone="warn"
            row={1}
          />
          <Tick position={100} label={String(j.speedValue(max))} align="end" />
        </div>
      ) : null}
    </div>
  );
}

function Tick({
  position,
  label,
  caption,
  tone,
  align = "center",
  row = 0,
}: Readonly<{
  position: number;
  label: string;
  caption?: string;
  tone?: StatusTone;
  align?: "center" | "end";
  /** Second row, for a tick that would otherwise overlap its neighbour. */
  row?: 0 | 1;
}>) {
  return (
    <div
      className="absolute flex flex-col items-center"
      style={{
        top: row === 1 ? 17 : 0,
        left: `${position}%`,
        transform: align === "end" ? "translateX(-100%)" : position === 0 ? "none" : "translateX(-50%)",
      }}
    >
      {row === 1 ? (
        <span aria-hidden className="absolute -top-[9px] h-[7px] w-px bg-[var(--line-strong)]" />
      ) : null}
      <span className="t-mono-sm leading-none text-[var(--text-3)]">{label}</span>
      {caption ? (
        <span
          className="mt-0.5 text-[8.5px] font-bold uppercase leading-none tracking-[0.08em]"
          style={{ color: tone ? toneVar[tone] : "var(--text-4)" }}
        >
          {caption}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Qualification progress.
 *
 * The ten-second sustain requirement is the heart of the rule, and this is the
 * only element in the product allowed to pulse continuously — because it marks
 * a rule that is actively counting, and stopping the count is a thing the
 * driver can still do.
 */
export function QualificationProgress({
  seconds,
  active,
  required = speedRule.minimumViolationDuration,
  speed,
  compact = false,
  className,
}: Readonly<{
  seconds: number;
  active: boolean;
  required?: number;
  speed?: number;
  compact?: boolean;
  className?: string;
}>) {
  const j = useJurisdiction();
  const pct = Math.min(100, (seconds / required) * 100);
  const remaining = Math.max(0, required - seconds);
  const qualified = seconds >= required;

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="t-label">{qualified ? "Evidence created" : active ? "Qualifying" : "Qualification"}</p>
        <p className="t-mono font-semibold text-[var(--text)]">
          <span className={cn(active && !qualified && "text-[var(--warn-text)]", qualified && "text-[var(--crit-text)]")}>
            {seconds.toFixed(1)}
          </span>
          <span className="text-[var(--text-4)]"> / {required.toFixed(1)}s</span>
        </p>
      </div>

      <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-[var(--surface-3)]">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-[var(--t-slow)] ease-out",
            qualified ? "bg-[var(--crit)]" : "bg-[var(--warn)]",
            active && !qualified && "a-urgent",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      {!compact ? (
        <p className="mt-1.5 text-[11px] leading-snug text-[var(--text-3)]">
          {qualified ? (
            <>Threshold sustained. Signed evidence record created.</>
          ) : active ? (
            <>
              Evidence will be created if{" "}
              {speed !== undefined ? <span className="t-mono text-[var(--text-2)]">{j.speed(speed)}</span> : "this speed"}{" "}
              is sustained for another{" "}
              <span className="t-mono font-semibold text-[var(--warn-text)]">{remaining.toFixed(1)}s</span>.
            </>
          ) : (
            <>No qualifying overspeed in progress. A brief spike never creates an event.</>
          )}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Large speed readout. Mono, because it is a measurement off a device — the
 * unit comes from the jurisdiction, never hardcoded.
 */
export function SpeedReadout({
  speed,
  limit = speedRule.defaultRoadLimit,
  tolerance = speedRule.tolerance,
  size = "lg",
  showLimit = true,
  className,
}: Readonly<{
  speed: number;
  limit?: number;
  tolerance?: number;
  size?: "md" | "lg" | "xl";
  showLimit?: boolean;
  className?: string;
}>) {
  const j = useJurisdiction();
  const tone = speedTone(speed, limit, tolerance);

  return (
    <div className={cn("min-w-0", className)}>
      <p className="flex items-baseline gap-1.5">
        <span
          className={cn(
            size === "md" && "t-metric",
            size === "lg" && "t-metric-lg",
            size === "xl" && "t-metric-xl",
          )}
          style={{ color: toneVar[tone] }}
        >
          {j.speedValue(speed)}
        </span>
        <span className="t-mono-sm font-semibold uppercase tracking-[0.08em] text-[var(--text-4)]">
          {j.speedUnitLabel}
        </span>
      </p>
      {showLimit ? (
        <p className="t-mono-sm mt-1 text-[var(--text-4)]">
          Limit {j.speedValue(limit)} · tolerance +{j.speedValue(tolerance)}
        </p>
      ) : null}
    </div>
  );
}

/** One-line statement of the active rule. Used in headers and settings. */
export function RuleSummary({ className }: Readonly<{ className?: string }>) {
  const j = useJurisdiction();
  return (
    <span className={cn("t-mono-sm text-[var(--text-4)]", className)}>
      {j.speedValue(speedRule.defaultRoadLimit)} + {j.speedValue(speedRule.tolerance)} {j.speedUnitLabel} ·{" "}
      {speedRule.minimumViolationDuration}s sustain · {speedRule.ruleVersion}
    </span>
  );
}

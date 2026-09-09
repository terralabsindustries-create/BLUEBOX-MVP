import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StatusTone } from "@/lib/status";
import { toneText } from "@/lib/status";

export type TimelineStep = {
  label: string;
  detail?: string;
  timestamp?: string;
  state: "done" | "active" | "pending" | "blocked";
};

/**
 * A chain of custody.
 *
 * This is the component that carries the product's central trust argument:
 * detected → qualified → signed → stored → uploaded → verified → available for
 * enforcement review. Showing it as a sequence, with each stage timestamped, is
 * what lets a reviewer see that the device did not decide anything a backend
 * had not verified. Steps that have not happened stay visibly unreached rather
 * than being hidden.
 */
export function Timeline({
  steps,
  orientation = "vertical",
  className,
}: Readonly<{ steps: TimelineStep[]; orientation?: "vertical" | "horizontal"; className?: string }>) {
  if (orientation === "horizontal") {
    return (
      <ol className={cn("flex min-w-0 items-stretch", className)}>
        {steps.map((step, index) => (
          <li key={step.label} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
            {index > 0 ? (
              <span
                aria-hidden
                className={cn(
                  "absolute left-0 top-[9px] h-px w-1/2",
                  step.state === "done" || step.state === "active" ? "bg-[var(--ok)]" : "bg-[var(--line)]",
                )}
              />
            ) : null}
            {index < steps.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  "absolute right-0 top-[9px] h-px w-1/2",
                  step.state === "done" ? "bg-[var(--ok)]" : "bg-[var(--line)]",
                )}
              />
            ) : null}
            <Marker state={step.state} />
            <span
              className={cn(
                "mt-1.5 px-1 text-[10.5px] font-medium leading-tight",
                step.state === "pending" || step.state === "blocked" ? "text-[var(--text-4)]" : "text-[var(--text)]",
              )}
            >
              {step.label}
            </span>
            {step.timestamp ? <span className="t-mono-sm mt-0.5 text-[var(--text-4)]">{step.timestamp}</span> : null}
          </li>
        ))}
      </ol>
    );
  }

  return (
    <ol className={cn("relative", className)}>
      {steps.map((step, index) => (
        <li key={step.label} className="relative flex gap-3 pb-3.5 last:pb-0">
          {index < steps.length - 1 ? (
            <span
              aria-hidden
              className={cn(
                "absolute bottom-0 left-[8.5px] top-[18px] w-px",
                step.state === "done" ? "bg-[var(--ok)]" : "bg-[var(--line)]",
              )}
            />
          ) : null}
          <Marker state={step.state} />
          <div className="min-w-0 flex-1 pb-0.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p
                className={cn(
                  "text-[12.5px] font-medium leading-tight",
                  step.state === "pending" || step.state === "blocked"
                    ? "text-[var(--text-4)]"
                    : "text-[var(--text)]",
                )}
              >
                {step.label}
              </p>
              {step.timestamp ? <p className="t-mono-sm text-[var(--text-4)]">{step.timestamp}</p> : null}
            </div>
            {step.detail ? (
              <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--text-3)]">{step.detail}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Marker({ state }: Readonly<{ state: TimelineStep["state"] }>) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative z-[1] grid h-[18px] w-[18px] flex-none place-items-center rounded-full border bg-[var(--panel)]",
        state === "done" && "border-[var(--ok)] bg-[var(--ok)] text-white",
        state === "active" && "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-on)]",
        state === "pending" && "border-[var(--line-strong)]",
        state === "blocked" && "border-[var(--warn)] bg-[var(--warn-dim)]",
      )}
    >
      {state === "done" ? <Check className="h-2.5 w-2.5" strokeWidth={3.5} /> : null}
      {state === "active" ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
      {state === "blocked" ? <span className="h-[7px] w-[1.5px] rounded-full bg-[var(--warn)]" /> : null}
    </span>
  );
}

/**
 * The chronological event stream. Distinct from `Timeline`: this is a log of
 * what happened, not the state of one record's progress.
 */
export function EventStream({
  items,
  className,
}: Readonly<{
  items: {
    id: string;
    timestamp: string;
    tone: StatusTone;
    subject?: string;
    message: string;
    detail?: string;
  }[];
  className?: string;
}>) {
  return (
    <ol className={cn("divide-y divide-[var(--line-soft)]", className)}>
      {items.map((item) => (
        <li key={item.id} className="flex gap-2.5 px-3.5 py-2">
          <span aria-hidden className="dot mt-[6px]" data-status={item.tone} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <time dateTime={item.timestamp} className="t-mono-sm shrink-0 text-[var(--text-4)]">
                {item.timestamp}
              </time>
              {item.subject ? <span className="t-mono truncate font-semibold text-[var(--text)]">{item.subject}</span> : null}
            </div>
            <p className={cn("mt-0.5 text-[12px] leading-snug", item.tone === "idle" ? "text-[var(--text-2)]" : toneText[item.tone])}>
              {item.message}
            </p>
            {item.detail ? <p className="t-mono-sm mt-0.5 text-[var(--text-4)]">{item.detail}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

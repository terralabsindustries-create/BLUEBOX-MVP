import { cn } from "@/lib/utils";
import {
  type LinkState,
  type Severity,
  type StatusTone,
  linkLabel,
  linkTone,
  severityTone,
  toneOf,
  toneText,
  toneVar,
} from "@/lib/status";

/**
 * Status primitives. Every state indicator in the product is one of these, so
 * an operator learns the vocabulary once.
 */

/* -------------------------------------------------------------------------- */
/* StatusBadge                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The default state indicator. `tone` is normally inferred from the label, so
 * a page can pass a domain value straight through and still land in the shared
 * vocabulary; pass `tone` explicitly only where the label is ambiguous
 * (for example "Open", which is critical for tamper but neutral elsewhere).
 */
export function StatusBadge({
  children,
  tone,
  dot = false,
  live = false,
  solid = false,
  className,
}: Readonly<{
  children: React.ReactNode;
  tone?: StatusTone;
  dot?: boolean;
  live?: boolean;
  solid?: boolean;
  className?: string;
}>) {
  const resolved = tone ?? toneOf(typeof children === "string" ? children : undefined);
  return (
    <span className={cn("chip", className)} data-status={resolved} data-solid={solid || undefined}>
      {dot ? <span aria-hidden className={cn("dot", live && "dot-live")} data-status={solid ? undefined : resolved} /> : null}
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* SeverityBadge                                                              */
/* -------------------------------------------------------------------------- */

/** Incident severity. Critical is solid so it outranks every other chip. */
export function SeverityBadge({ severity, className }: Readonly<{ severity: Severity; className?: string }>) {
  return (
    <StatusBadge tone={severityTone[severity]} solid={severity === "Critical"} className={className}>
      {severity}
    </StatusBadge>
  );
}

/* -------------------------------------------------------------------------- */
/* StatusDot                                                                  */
/* -------------------------------------------------------------------------- */

/** A bare state marker. Always accompanied by an adjacent text label. */
export function StatusDot({
  tone,
  live = false,
  className,
}: Readonly<{ tone: StatusTone; live?: boolean; className?: string }>) {
  return <span aria-hidden className={cn("dot", live && "dot-live", className)} data-status={tone} />;
}

/* -------------------------------------------------------------------------- */
/* ConnectivityIndicator                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A transport link: the bridge, the Android simulator or the physical BlueBox.
 *
 * The state label is always rendered, never implied by the dot alone — an
 * operator must be able to tell `PAIRING` from `CONNECTED` in a screenshot, in
 * greyscale, and with a colour-vision deficiency.
 */
export function ConnectivityIndicator({
  state,
  label,
  detail,
  className,
}: Readonly<{
  state: LinkState;
  label: string;
  detail?: string;
  className?: string;
}>) {
  const tone = linkTone[state];
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <StatusDot tone={tone} live={state === "connected"} />
      <span className="min-w-0">
        <span className="block truncate text-[11.5px] font-medium leading-tight text-[var(--text)]">{label}</span>
        <span className="t-mono-sm block truncate leading-tight text-[var(--text-4)]">
          {detail ?? linkLabel[state]}
        </span>
      </span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* VerificationState                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Whether a piece of evidence has cleared backend verification. This is the
 * product's highest-trust signal, so it gets its own component rather than a
 * generic badge — the distinction between "signed on the device" and "verified
 * by the backend" must never blur.
 */
export function VerificationState({
  verified,
  pendingLabel = "Awaiting verification",
  verifiedLabel = "Backend verified",
  className,
}: Readonly<{ verified: boolean; pendingLabel?: string; verifiedLabel?: string; className?: string }>) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {verified ? (
        <svg aria-hidden viewBox="0 0 14 14" className="h-3.5 w-3.5 flex-none text-[var(--ok)]">
          <circle cx="7" cy="7" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M4.2 7.2l1.9 1.9 3.7-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg aria-hidden viewBox="0 0 14 14" className="h-3.5 w-3.5 flex-none text-[var(--warn)]">
          <circle cx="7" cy="7" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M7 3.8v3.6l2.2 1.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      <span
        className={cn(
          "text-[11.5px] font-medium",
          verified ? "text-[var(--ok-text)]" : "text-[var(--warn-text)]",
        )}
      >
        {verified ? verifiedLabel : pendingLabel}
      </span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* DeviceStateIndicator                                                       */
/* -------------------------------------------------------------------------- */

/**
 * A device subsystem readout — BLE, GNSS, storage, power. Compact enough to
 * sit four-across inside a table row's expanded detail.
 */
export function DeviceStateIndicator({
  label,
  value,
  tone,
  className,
}: Readonly<{ label: string; value: string; tone?: StatusTone; className?: string }>) {
  const resolved = tone ?? toneOf(value);
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5", className)}>
      <StatusDot tone={resolved} />
      <span className="t-label shrink-0">{label}</span>
      <span className={cn("t-mono truncate font-medium", toneText[resolved])}>{value}</span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Meter                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A proportion bar. Used for storage, uptime, share-of-total and ranking —
 * anywhere a percentage needs a magnitude channel as well as a number.
 */
export function Meter({
  value,
  max = 100,
  tone = "info",
  label,
  className,
}: Readonly<{ value: number; max?: number; tone?: StatusTone; label?: string; className?: string }>) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <span
      role={label ? "meter" : undefined}
      aria-label={label}
      aria-valuenow={label ? value : undefined}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? max : undefined}
      className={cn("block h-[4px] w-full overflow-hidden rounded-full bg-[var(--panel-inset)]", className)}
    >
      <span
        className="block h-full rounded-full transition-[width] duration-[var(--t-slow)] ease-[var(--ease-out)]"
        style={{ width: `${pct}%`, background: toneVar[tone] }}
      />
    </span>
  );
}

/**
 * THE STATUS VOCABULARY
 *
 * One vocabulary, resolved in one place, used by all thirteen routes. "OFFLINE"
 * is the same colour on Live Operations, the Devices table, the map and the
 * audit trail, because an operator should learn this language once.
 *
 * Seven tones. Six of them are status; one — `brand` — is not:
 *
 *   ok        healthy · online · connected · verified · resolved
 *   info      processing · uploading · restoring · informational system state
 *   warn      degraded · pending · review · near threshold
 *   crit      violation · critical · failure · rejected
 *   tamper    physical or firmware integrity event (security, not speed)
 *   idle      offline · unknown · not reporting · disabled
 *   brand     SELECTED / ACTIVE — TerraLabs orange. Never a hazard.
 *
 * `brand` is listed here so components have one place to reach for the
 * selection colour, but `toneOf()` will never return it: no device state ever
 * resolves to orange. That separation is what keeps a selected row from
 * looking like an alarm.
 */
export type StatusTone = "ok" | "info" | "warn" | "crit" | "tamper" | "idle" | "brand";

/** Tones that `toneOf()` may return — i.e. genuine operational status. */
export type OperationalTone = Exclude<StatusTone, "brand">;

/** Canonical state labels, used as display strings product-wide. */
export const STATE_LABEL = {
  connected: "CONNECTED",
  online: "ONLINE",
  healthy: "HEALTHY",
  verified: "VERIFIED",
  pending: "PENDING",
  processing: "PROCESSING",
  warning: "WARNING",
  critical: "CRITICAL",
  offline: "OFFLINE",
  tamper: "TAMPER",
  rejected: "REJECTED",
  uploading: "UPLOADING",
  restored: "RESTORED",
  degraded: "DEGRADED",
} as const;

const OK =
  /^(healthy|online|active|connected|operational|success|passed|verified|uploaded|normal|good|strong|valid|closed|resolved|delivered|applied|in service|nominal|complete|ready|synchronized|synchronised|notice generated|notice eligible|generated|issued)$/;
const TAMPER = /^(tamper|tampered|case[_ ]open|device[_ ]unplugged|unplugged|firmware[_ ]integrity[_ ]failure|breach|intrusion)$/;
const CRIT = /^(critical|failure|failed|error|lost|escalated|rejected|violation|overspeed|open)$/;
const WARN =
  /^(warning|warn|degraded|pending|poor|weak|review|under review|service|service required|fair|near|near limit|retry|delayed|watch|investigating|attention|inspection due|appeal submitted|backup)$/;
const IDLE = /^(offline|unavailable|unknown|no data|disabled|inactive|idle|disconnected|none|not reporting|never|stopped)$/;
const INFO =
  /^(info|verifying|restoring|connecting|processing|scheduled|notice|uploading|queued|reconnecting|scanning|pairing|restored|syncing|synchronising|synchronizing|signed|signed locally)$/;

/**
 * Resolve any domain string to a tone. Exact match first, then a substring
 * pass so compound values — event-type constants like `GNSS_LOSS_EVENT`, or
 * whole sentences — still land somewhere sensible instead of defaulting.
 *
 * Tamper is tested before critical: a `TAMPER_OPEN_EVENT` is a security
 * incident, not a speed violation, and the two must never share a colour.
 */
export function toneOf(value: string | null | undefined): OperationalTone {
  if (!value) return "idle";
  const key = value.toLowerCase().trim();

  if (TAMPER.test(key)) return "tamper";
  if (OK.test(key)) return "ok";
  if (CRIT.test(key)) return "crit";
  if (WARN.test(key)) return "warn";
  if (IDLE.test(key)) return "idle";
  if (INFO.test(key)) return "info";

  if (/(tamper|firmware_integrity|unplugged|case_open|breach)/.test(key)) return "tamper";
  if (/(offline|unavailable|no data|disconnect|never|not reporting)/.test(key)) return "idle";
  if (/(critical|reject|fail|error|violation|overspeed)/.test(key)) return "crit";
  if (/(warn|degrad|pending|poor|weak|review|retry|watch|investigat|suspect|loss)/.test(key)) return "warn";
  if (/(upload|queue|verify|connect|process|restor|sign)/.test(key)) return "info";
  if (/(healthy|online|active|ok|pass|valid|good|normal|resolved|verified)/.test(key)) return "ok";

  return "idle";
}

/* -------------------------------------------------------------------------- */
/* Severity                                                                   */
/* -------------------------------------------------------------------------- */

export type Severity = "Low" | "Medium" | "High" | "Critical";

export const severityTone: Record<Severity, OperationalTone> = {
  Low: "idle",
  Medium: "warn",
  High: "crit",
  Critical: "crit",
};

export const severityRank: Record<Severity, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };

/* -------------------------------------------------------------------------- */
/* Violation level                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Violation severity. L0 is a non-event — the rule looked and did not qualify
 * — so it reads as a pass; everything above escalates.
 */
export function levelTone(level: string): OperationalTone {
  switch (level) {
    case "L1":
      return "warn";
    case "L2":
    case "L3":
    case "L4":
      return "crit";
    default:
      return "ok";
  }
}

export const LEVEL_DESCRIPTION: Record<string, string> = {
  L0: "Below qualification threshold",
  L1: "Up to 95 km/h",
  L2: "96 – 110 km/h",
  L3: "Above 110 km/h",
  L4: "Reserved",
};

/* -------------------------------------------------------------------------- */
/* Tone → token maps                                                          */
/* -------------------------------------------------------------------------- */

export const toneText: Record<StatusTone, string> = {
  ok: "text-[var(--ok-text)]",
  info: "text-[var(--info-text)]",
  warn: "text-[var(--warn-text)]",
  crit: "text-[var(--crit-text)]",
  tamper: "text-[var(--tamper-text)]",
  idle: "text-[var(--idle-text)]",
  brand: "text-[var(--brand-text)]",
};

export const toneVar: Record<StatusTone, string> = {
  ok: "var(--ok)",
  info: "var(--info)",
  warn: "var(--warn)",
  crit: "var(--crit)",
  tamper: "var(--tamper)",
  idle: "var(--idle)",
  brand: "var(--brand)",
};

/**
 * Raw hex, for SVG, canvas and Leaflet, where CSS custom properties are not
 * resolvable. These mirror the dark-theme values in globals.css.
 */
export const toneHex: Record<StatusTone, string> = {
  ok: "#2FBF71",
  info: "#35A7E8",
  warn: "#F5A524",
  crit: "#F4364C",
  tamper: "#FF4D8D",
  idle: "#7D8790",
  brand: "#FF5D3A",
};

/* -------------------------------------------------------------------------- */
/* Transport links                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Link lifecycle.
 *
 * A link that snaps from false to true reads as fake, so the UI shows the
 * stages the transport genuinely passes through. `scanning` and `pairing` are
 * declared for the real Windows BLE path, which reports them; the local bridge
 * only reaches `connecting` → `synchronizing` → `connected`, and the progress
 * indicator is sized to whatever the active transport actually emits.
 */
export type LinkState = "connected" | "synchronizing" | "pairing" | "scanning" | "connecting" | "disconnected" | "unavailable";

export const linkTone: Record<LinkState, OperationalTone> = {
  connected: "ok",
  synchronizing: "info",
  pairing: "info",
  scanning: "info",
  connecting: "warn",
  disconnected: "crit",
  unavailable: "idle",
};

export const linkLabel: Record<LinkState, string> = {
  connected: "CONNECTED",
  synchronizing: "SYNCHRONIZING",
  pairing: "PAIRING",
  scanning: "SCANNING",
  connecting: "CONNECTING",
  disconnected: "DISCONNECTED",
  unavailable: "UNAVAILABLE",
};

/** The stages the local bridge actually passes through, in order. */
export const LINK_SEQUENCE: LinkState[] = ["connecting", "synchronizing", "connected"];

/* -------------------------------------------------------------------------- */
/* Enforcement state                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Where a vehicle sits in the speed rule right now — which is not the same as
 * its device state. Derived in one place (see `enforcementStateOf`) so the
 * table, the map, the attention list and the detail panel can never disagree
 * about the same vehicle.
 */
export type EnforcementState = "normal" | "near" | "overspeed" | "violation" | "offline" | "tamper";

export const enforcementLabel: Record<EnforcementState, string> = {
  normal: "Normal",
  near: "Near limit",
  overspeed: "Overspeed",
  violation: "Violation",
  offline: "Offline",
  tamper: "Tamper",
};

export const enforcementTone: Record<EnforcementState, OperationalTone> = {
  normal: "ok",
  near: "warn",
  overspeed: "crit",
  violation: "crit",
  offline: "idle",
  tamper: "tamper",
};

/** Triage order: what an operator must look at first. */
export const enforcementRank: Record<EnforcementState, number> = {
  tamper: 5,
  violation: 4,
  overspeed: 3,
  offline: 2,
  near: 1,
  normal: 0,
};

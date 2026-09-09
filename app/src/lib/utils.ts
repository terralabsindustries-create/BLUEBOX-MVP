import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Vehicle } from "@/lib/types";
import { type EnforcementState } from "@/lib/status";
import { speedRule } from "@/lib/rules/speed-rule";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* -------------------------------------------------------------------------- */
/* Time                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * All timestamps render in the deployment's own locale and zone. Operators
 * correlate what they see here with radio traffic and with paper records, so
 * the format has to be unambiguous rather than compact.
 */
export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

/** Clock time only — for dense tables and the live feed. */
export function formatClock(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

/** Retained name used across the app for the same short clock format. */
export const formatCompactTime = formatClock;

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

/** Seconds as `1m 04s` / `2h 13m`. Used for offline duration and uptime. */
export function formatDuration(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total}s`;
  if (total < 3600) return `${Math.floor(total / 60)}m ${String(total % 60).padStart(2, "0")}s`;
  const hours = Math.floor(total / 3600);
  return `${hours}h ${String(Math.floor((total % 3600) / 60)).padStart(2, "0")}m`;
}

/** Elapsed time between two ISO instants, as an operational "ago" reading. */
export function elapsedSince(value: string, now: string) {
  const diff = Math.max(0, (new Date(now).getTime() - new Date(value).getTime()) / 1000);
  return `${formatDuration(diff)} ago`;
}

/** Retained name for the same reading. */
export const relativeSeconds = elapsedSince;

export function elapsedSeconds(value: string, now: string) {
  return Math.max(0, Math.round((new Date(now).getTime() - new Date(value).getTime()) / 1000));
}

/* -------------------------------------------------------------------------- */
/* Values                                                                     */
/* -------------------------------------------------------------------------- */

export function formatNumber(value: number) {
  return value.toLocaleString("en-IN");
}

export function percent(value: number, total: number, digits = 1) {
  if (!total) return "0.0%";
  return `${((value / total) * 100).toFixed(digits)}%`;
}

/** Evidence hashes and signatures — head and tail, never the silent middle. */
export function shortHash(value: string) {
  if (value.length <= 24) return value;
  return `${value.slice(0, 12)}…${value.slice(-8)}`;
}

/** GNSS coordinates in the decimal form used by the device payloads. */
export function formatCoords(coords: [number, number]) {
  return `${coords[0].toFixed(5)}°N  ${coords[1].toFixed(5)}°E`;
}

/* -------------------------------------------------------------------------- */
/* Enforcement                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Where a vehicle sits in the speed rule right now.
 *
 * This is derived in exactly one place because the map, the fleet table, the
 * attention list and the vehicle drawer all display it — if they each computed
 * it, they could disagree, and a disagreement between two views of the same
 * vehicle is exactly the kind of thing that destroys trust in an enforcement
 * system. Integrity outranks connectivity, which outranks speed: a tampered
 * device is a tamper case even if it is also speeding.
 */
export function enforcementStateOf(vehicle: Vehicle): EnforcementState {
  const { telemetry } = vehicle;
  if (telemetry.tamperState !== "normal" || telemetry.powerState === "loss") return "tamper";
  if (telemetry.networkState === "offline") return "offline";
  const trigger = telemetry.roadLimit + telemetry.tolerance;
  if (telemetry.speed > trigger) return "overspeed";
  if (telemetry.speed > telemetry.roadLimit) return "near";
  return "normal";
}

/** The speed at which the rule starts counting toward a qualified violation. */
export function triggerSpeedOf(vehicle: Vehicle) {
  return vehicle.telemetry.roadLimit + vehicle.telemetry.tolerance;
}

/**
 * Whether the device can produce an enforcement input at all. GNSS quality is
 * a gate, not a warning: with no valid fix the rule is suppressed entirely.
 */
export function canEnforce(vehicle: Vehicle) {
  return vehicle.telemetry.gps.validFix && vehicle.telemetry.gps.state !== "lost";
}

export const RULE_SUMMARY = `Limit ${speedRule.defaultRoadLimit} km/h · tolerance +${speedRule.tolerance} · qualify above ${speedRule.triggerSpeed} km/h sustained ${speedRule.minimumViolationDuration}s`;

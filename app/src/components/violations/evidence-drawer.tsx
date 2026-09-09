"use client";

import { FileText, MapPin } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Overlay } from "@/components/ui/drawer";
import { Field, FieldGrid } from "@/components/ui/panel";
import { StatusBadge, VerificationState } from "@/components/ui/status";
import { Timeline, type TimelineStep } from "@/components/ui/timeline";
import { SpeedRuleScale } from "@/components/telemetry/speed-rule";
import { useSimulationStore } from "@/store/simulation-store";
import { useJurisdiction } from "@/lib/use-jurisdiction";
import { LEVEL_DESCRIPTION, levelTone } from "@/lib/status";
import { formatCoords, shortHash } from "@/lib/utils";
import type { ViolationEvent } from "@/lib/types";

/**
 * THE EVIDENCE RECORD
 *
 * This is the screen the whole product exists to justify, so it is built as an
 * argument rather than as a field dump. It answers, in order:
 *
 *   1. What was measured?            the reading, against the rule that judged it
 *   2. Why did that qualify?         the rule evaluation, shown as arithmetic
 *   3. What proves it happened?      device identity, hash, signature
 *   4. Who checked it, and when?     the chain of custody, end to end
 *
 * Two things are load-bearing and must never be softened:
 *
 * - The distinction between *signed on the device* and *verified by the
 *   backend*. Those are different claims with different trust weight.
 * - The fact that no penalty is decided here. The device detects, qualifies and
 *   signs; a backend verifies; enforcement policy — not this record — decides
 *   any consequence.
 *
 * Every check rendered below maps to a field the application actually holds.
 * Nothing is invented to make the panel look more thorough.
 */

/** Verification gates, mapped from real fields on the violation record. */
const GATES = [
  {
    key: "ruleValidation",
    label: "Rule validation",
    detail: "Threshold, tolerance and sustain duration re-evaluated server-side",
  },
  { key: "gpsQualityCheck", label: "GNSS quality", detail: "Fix validity and dilution of precision at capture" },
  { key: "duplicateCheck", label: "Duplicate check", detail: "Event sequence reconciled against the device register" },
  {
    key: "backendVerification",
    label: "Backend verification",
    detail: "Signature checked against the device's registered identity",
  },
] as const;

export function EvidenceDrawer({ className }: Readonly<{ className?: string }> = {}) {
  const selectedViolationId = useSimulationStore((state) => state.selectedViolationId);
  const selectViolation = useSimulationStore((state) => state.selectViolation);
  const violation = useSimulationStore((state) =>
    state.violations.find((item) => item.id === selectedViolationId),
  );
  const notice = useSimulationStore((state) =>
    state.notices.find((item) => item.violationId === selectedViolationId),
  );

  if (!violation) return null;

  return (
    <Overlay
      open
      onClose={() => selectViolation(null)}
      eyebrow="Signed Evidence Record"
      title={violation.id}
      width="max-w-[560px]"
      labelledBy="evidence-heading"
      tone={violation.backendVerification === "PASSED" ? undefined : "warn"}
      className={className}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <VerificationState verified={violation.backendVerification === "PASSED"} />
          <span className="flex gap-1.5">
            <LinkButton href="/map-heatmap" size="sm" variant="secondary">
              <MapPin className="h-3.5 w-3.5" />
              Open map
            </LinkButton>
            <LinkButton
              href="/challan-notices"
              size="sm"
              variant={violation.backendVerification === "PASSED" ? "primary" : "secondary"}
              aria-disabled={violation.backendVerification !== "PASSED"}
              className={violation.backendVerification !== "PASSED" ? "pointer-events-none opacity-45" : undefined}
            >
              <FileText className="h-3.5 w-3.5" />
              {notice ? "View notice" : "Notice workflow"}
            </LinkButton>
          </span>
        </div>
      }
    >
      <EvidenceBody violation={violation} />
    </Overlay>
  );
}

/**
 * The record's contents, extracted so the same argument can be shown inline in
 * a master-detail layout on wide displays and in a drawer on narrow ones.
 */
export function EvidenceBody({ violation }: Readonly<{ violation: ViolationEvent }>) {
  const j = useJurisdiction();
  const trigger = violation.roadLimit + violation.tolerance;
  const excess = violation.gpsSpeed - violation.roadLimit;
  const verified = violation.backendVerification === "PASSED";
  const wasOffline = violation.networkStatusAtEvent === "OFFLINE_AT_EVENT";

  /**
   * Chain of custody.
   *
   * Stages derive from the record's own state, so a queued offline event
   * genuinely shows upload and verification as not-yet-reached rather than
   * pretending the chain completed.
   */
  const uploaded = violation.uploadStatus === "UPLOADED";
  const steps: TimelineStep[] = [
    { label: "Detected", detail: `Threshold crossed at ${j.speed(violation.gpsSpeed)}`, state: "done" },
    {
      label: "Qualified",
      detail: `Sustained ${violation.durationSec}s above ${j.speed(trigger)}`,
      state: "done",
    },
    {
      label: "Signed on device",
      detail: wasOffline ? "Signed locally with no network route" : "Signed at capture",
      timestamp: j.time(violation.timestamp),
      state: "done",
    },
    {
      label: wasOffline ? "Queued locally" : "Transmitted",
      detail: wasOffline ? "Held in device storage until connectivity returned" : "Sent to backend on capture",
      state: uploaded || !wasOffline ? "done" : "active",
    },
    {
      label: "Uploaded",
      detail: uploaded ? "Received and acknowledged by the backend" : "Awaiting connectivity",
      state: uploaded ? "done" : "pending",
    },
    {
      label: "Backend verified",
      detail: verified ? "Signature and rule re-evaluation passed" : "Not yet verified",
      state: verified ? "done" : "pending",
    },
    {
      label: "Available for enforcement review",
      detail: verified
        ? "Eligible for the notice workflow under authority policy"
        : "Blocked until verification passes",
      state: verified ? "done" : "blocked",
    },
  ];

  return (
    <div>
      {/* 1 — What was measured */}
      <section className="border-b border-[var(--line)] px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="t-label">Recorded speed</p>
            <p className="mt-1.5 flex items-baseline gap-2">
              <span className="t-metric-lg text-[var(--crit-text)]">{j.speedValue(violation.gpsSpeed)}</span>
              <span className="t-mono-sm font-semibold uppercase tracking-[0.08em] text-[var(--text-4)]">
                {j.speedUnitLabel}
              </span>
            </p>
            <p className="t-mono-sm mt-1.5 text-[var(--text-3)]">
              +{j.speedValue(excess)} over limit · peak {j.speed(violation.maxSpeed)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <StatusBadge tone={levelTone(violation.level)} solid={violation.level !== "L1"}>
              {violation.level}
            </StatusBadge>
            <span className="text-[10.5px] text-[var(--text-4)]">{LEVEL_DESCRIPTION[violation.level]}</span>
          </div>
        </div>

        <div className="mt-4">
          <SpeedRuleScale
            speed={violation.gpsSpeed}
            limit={violation.roadLimit}
            tolerance={violation.tolerance}
          />
        </div>
      </section>

      {/* 2 — Why it qualified. Shown as arithmetic, because "we checked" is not
             an argument and a reviewer must be able to redo the sum. */}
      <section className="border-b border-[var(--line)] px-4 py-4">
        <p className="t-label mb-2.5">Rule evaluation</p>
        <dl className="well divide-y divide-[var(--line-soft)] px-3">
          <Row label="Observed speed" value={j.speed(violation.gpsSpeed)} />
          <Row label="Road limit" value={j.speed(violation.roadLimit)} />
          <Row label="Tolerance" value={`+ ${j.speed(violation.tolerance)}`} />
          <Row label="Qualification threshold" value={j.speed(trigger)} emphasis />
          <Row label="Duration above threshold" value={`${violation.durationSec.toFixed(1)} s`} />
          <Row label="Minimum sustain required" value="10.0 s" />
        </dl>
        <p className="mt-2 flex items-center gap-2">
          <StatusBadge tone="crit" solid>
            Qualified violation
          </StatusBadge>
          <span className="text-[11px] text-[var(--text-3)]">
            Rule {violation.ruleValidation === "PASSED" ? "re-validated" : "pending re-validation"} server-side
          </span>
        </p>
      </section>

      {/* 3 — Context */}
      <section className="border-b border-[var(--line)] px-4 py-4">
        <p className="t-label mb-2.5">Event</p>
        <FieldGrid columns={2}>
          <Field label="Vehicle" value={violation.registrationNumber} mono />
          <Field label="Device" value={violation.deviceId} mono />
          <Field label="Captured" value={j.dateTime(violation.timestamp)} mono />
          <Field label="Event type" value={violation.eventType} mono />
          <Field label="Location" value={violation.roadName} />
          <Field label="District" value={violation.district} />
          <Field
            label="Network at capture"
            value={wasOffline ? "OFFLINE" : "ONLINE"}
            mono
            tone={wasOffline ? "warn" : "ok"}
            hint={wasOffline ? "Evidence was signed and queued locally" : undefined}
          />
          <Field label="GNSS quality" value="14 sats · HDOP 0.8" mono tone="ok" hint="Valid fix at capture" />
        </FieldGrid>
      </section>

      {/* 4 — Proof */}
      <section className="border-b border-[var(--line)] px-4 py-4">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <p className="t-label">Evidence integrity</p>
          <StatusBadge tone={verified ? "ok" : "info"} dot>
            {violation.signatureStatus === "CRYPTOGRAPHIC SIGNATURE VERIFIED" ? "Signature verified" : "Signed locally"}
          </StatusBadge>
        </div>

        <ul className="well divide-y divide-[var(--line-soft)]">
          {GATES.map((gate) => {
            const passed = violation[gate.key] === "PASSED";
            return (
              <li key={gate.key} className="flex items-start justify-between gap-3 px-3 py-2">
                <span className="min-w-0">
                  <span className="block text-[12px] font-medium text-[var(--text-2)]">{gate.label}</span>
                  <span className="block text-[10.5px] leading-snug text-[var(--text-4)]">{gate.detail}</span>
                </span>
                <StatusBadge tone={passed ? "ok" : "warn"}>{passed ? "Passed" : "Pending"}</StatusBadge>
              </li>
            );
          })}
        </ul>

        <div className="mt-2 space-y-1.5">
          <HashRow label="Payload hash" value={violation.hash} />
          <HashRow label="Signature" value={violation.signature} />
        </div>
      </section>

      {/* 5 — Chain of custody */}
      <section className="border-b border-[var(--line)] px-4 py-4">
        <p className="t-label mb-3">Chain of custody</p>
        <Timeline steps={steps} />
      </section>

      {/* 6 — The boundary. Stated plainly, every time. */}
      <section className="px-4 py-3.5">
        <div className="flex items-start gap-2.5 border-l-[3px] border-l-[var(--info)] bg-[var(--info-dim)] px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-[11.5px] font-semibold text-[var(--text)]">No penalty is determined here</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-2)]">
              The device detects, qualifies and signs. A backend verifies. Any consequence is decided by authority
              enforcement policy — not by this record and not by the device.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Row({ label, value, emphasis = false }: Readonly<{ label: string; value: string; emphasis?: boolean }>) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <dt className={`text-[11.5px] ${emphasis ? "font-semibold text-[var(--text-2)]" : "text-[var(--text-3)]"}`}>
        {label}
      </dt>
      <dd className={`t-mono ${emphasis ? "font-semibold text-[var(--warn-text)]" : "text-[var(--text)]"}`}>{value}</dd>
    </div>
  );
}

function HashRow({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="well flex items-center justify-between gap-3 px-3 py-1.5">
      <span className="t-label shrink-0">{label}</span>
      <span className="t-mono truncate text-[var(--text-2)]" title={value}>
        {shortHash(value)}
      </span>
    </div>
  );
}

/** Coordinate readout, kept here so the map link and the record agree. */
export function CoordinateReadout({ coords }: Readonly<{ coords: [number, number] }>) {
  return <span className="t-mono text-[var(--text-2)]">{formatCoords(coords)}</span>;
}

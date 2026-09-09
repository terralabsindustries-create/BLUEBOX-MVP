"use client";

import { useMemo } from "react";
import { Radio } from "lucide-react";
import { DetailPane } from "@/components/ui/drawer";
import { Field, FieldGrid } from "@/components/ui/panel";
import { Readout } from "@/components/ui/metric";
import { SpeedCell } from "@/components/ui/data-table";
import { StatusBadge, StatusDot } from "@/components/ui/status";
import { ConditionState, EmptyState } from "@/components/ui/states";
import { EventStream } from "@/components/ui/timeline";
import { QualificationProgress, SpeedReadout, SpeedRuleScale } from "@/components/telemetry/speed-rule";
import { useSimulationStore } from "@/store/simulation-store";
import { useJurisdiction } from "@/lib/use-jurisdiction";
import { canEnforce, cn, elapsedSince, enforcementStateOf, formatCoords, triggerSpeedOf } from "@/lib/utils";
import { type StatusTone, enforcementLabel, enforcementTone, toneOf } from "@/lib/status";
import type { ActivityItem, PowerState, Vehicle } from "@/lib/types";

/**
 * THE VEHICLE RECORD
 *
 * One inspection panel, shared by Live Operations, the Overview and Vehicle
 * Search — because an operator who has learned to read a vehicle on one screen
 * must not have to re-learn it on another, and three implementations of the
 * same record are three chances for them to disagree.
 *
 * It answers, top to bottom: who is this, what is it doing right now, can its
 * device be trusted, what has happened to it, and where is it.
 */

/**
 * Only this device is driven by the simulation engine, so only this device has
 * a qualification counter that describes it. Rendering another vehicle's
 * countdown beside a stranger's plate would be a fabrication, and this record
 * is the wrong place in the product to be approximately right.
 */
const INSTRUMENTED_VEHICLE_ID = "vehicle-1";

const POWER_LABEL: Record<PowerState, string> = {
  normal: "NORMAL",
  backup: "ON BACKUP",
  loss: "LOSS",
};

/** Power loss is scored as an integrity event, matching `enforcementStateOf`. */
const POWER_TONE: Record<PowerState, StatusTone> = {
  normal: "ok",
  backup: "warn",
  loss: "tamper",
};

const ACTIVITY_TONE: Record<ActivityItem["severity"], StatusTone> = {
  info: "info",
  success: "ok",
  warning: "warn",
  critical: "crit",
};

export function VehicleDetail({
  vehicleId,
  onClose,
  className,
}: Readonly<{ vehicleId: string; onClose?: () => void; className?: string }>) {
  const j = useJurisdiction();
  const now = useSimulationStore((state) => state.now);
  const vehicle = useSimulationStore((state) => state.vehicles.find((item) => item.id === vehicleId));
  const qualificationSeconds = useSimulationStore((state) => state.qualificationSeconds);
  const qualificationActive = useSimulationStore((state) => state.qualificationActive);
  const activity = useSimulationStore((state) => state.activity);
  const tamperEvents = useSimulationStore((state) => state.tamperEvents);
  const fitmentCenters = useSimulationStore((state) => state.fitmentCenters);

  const registration = vehicle?.registrationNumber ?? "";
  const deviceId = vehicle?.device.id ?? "";

  /**
   * The feed carries no vehicle key, so entries are matched on the identifiers
   * they actually name. Tamper events do carry one, and are matched on it.
   */
  const events = useMemo(() => {
    if (!vehicle) return [];

    const fromActivity = activity
      .filter((item) => item.message.includes(registration) || item.message.includes(deviceId))
      .map((item) => ({
        id: item.id,
        timestamp: item.timestamp,
        tone: ACTIVITY_TONE[item.severity],
        message: item.message,
      }));

    const fromTamper = tamperEvents
      .filter((event) => event.vehicleId === vehicle.id)
      .map((event) => ({
        id: event.id,
        timestamp: event.timestamp,
        tone: toneOf(event.eventType),
        subject: event.id,
        message: event.eventType.replace(/_/g, " "),
        detail: `${event.severity} · ${event.status} · ${event.location}`,
      }));

    return [...fromActivity, ...fromTamper]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 8);
  }, [vehicle, activity, tamperEvents, registration, deviceId]);

  if (!vehicle) return null;

  const { telemetry, device } = vehicle;
  const state = enforcementStateOf(vehicle);
  const trigger = triggerSpeedOf(vehicle);
  const overTrigger = telemetry.speed > trigger;
  const enforceable = canEnforce(vehicle);
  const instrumented = vehicle.id === INSTRUMENTED_VEHICLE_ID;
  const fitmentCenter = fitmentCenters.find((centre) => centre.id === device.fitmentCenterId);

  return (
    <DetailPane
      className={className}
      eyebrow="Vehicle record"
      title={<span className="t-reg text-[15px]">{registration}</span>}
      onClose={onClose}
      // A tamper case deliberately takes no header wash: red would file a
      // security event under speeding, which is the one confusion the status
      // scale exists to prevent. The magenta chip carries it instead.
      tone={state === "overspeed" ? "crit" : state === "near" ? "warn" : undefined}
    >
      <section className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-[var(--line)] px-3.5 py-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-[var(--text)]">{vehicle.ownerName}</p>
          <p className="t-meta mt-0.5 truncate">
            {vehicle.vehicleType} · {vehicle.category}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <StatusBadge tone={enforcementTone[state]} dot live={instrumented && state !== "offline"}>
            {enforcementLabel[state]}
          </StatusBadge>
          <StatusBadge>{vehicle.serviceStatus}</StatusBadge>
        </div>
      </section>

      <section className="border-b border-[var(--line)] px-3.5 py-3.5">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          {/* A device with no network route is not reporting. Its last stored
              reading is still useful, but presenting it in the live instrument
              would state something the system does not currently know. */}
          {state === "offline" ? (
            <div className="min-w-0">
              <p className="t-label">Last known speed</p>
              <p className="mt-1 flex items-baseline gap-1.5">
                <span className="t-metric-lg text-[var(--idle-text)]">{j.speedValue(telemetry.speed)}</span>
                <span className="t-mono-sm font-semibold uppercase tracking-[0.08em] text-[var(--text-4)]">
                  {j.speedUnitLabel}
                </span>
              </p>
              <p className="t-mono-sm mt-1 text-[var(--text-4)]">
                Not reporting · {elapsedSince(telemetry.heartbeatAt, now)}
              </p>
            </div>
          ) : (
            <SpeedReadout speed={telemetry.speed} limit={telemetry.roadLimit} tolerance={telemetry.tolerance} size="lg" />
          )}
          <Readout
            label={overTrigger ? "Above trigger" : "Below trigger"}
            value={j.speedValue(Math.abs(trigger - telemetry.speed))}
            unit={j.speedUnitLabel}
            tone={overTrigger ? "crit" : undefined}
          />
        </div>

        <SpeedRuleScale
          className="mt-3.5"
          speed={telemetry.speed}
          limit={telemetry.roadLimit}
          tolerance={telemetry.tolerance}
        />

        {instrumented ? (
          <QualificationProgress
            className="mt-4"
            seconds={qualificationSeconds}
            active={qualificationActive}
            speed={telemetry.speed}
          />
        ) : (
          <p className="mt-3.5 text-[11px] leading-snug text-[var(--text-4)]">
            Sustain counters are reported by the instrumented device only. This record shows the last reading
            transmitted by this vehicle, {elapsedSince(telemetry.lastUpdateAt, now)}.
          </p>
        )}
      </section>

      {!enforceable ? (
        <div className="border-b border-[var(--line)]">
          <ConditionState
            tone="warn"
            title="Enforcement suppressed"
            description="Without a valid GNSS fix the speed rule is not evaluated, so no evidence can be created from this device."
          />
        </div>
      ) : null}

      <section className="space-y-3.5 border-b border-[var(--line)] px-3.5 py-3.5">
        <Subsystem title="Positioning">
          <Field
            label="GNSS"
            // The effective state, not the nominal mode: a receiver can report
            // "valid" while holding no usable fix, and the rule cares only
            // about the fix. Showing the mode alone would contradict the
            // suppression notice directly above it.
            value={telemetry.gps.validFix ? telemetry.gps.state.toUpperCase() : "NO FIX"}
            tone={telemetry.gps.validFix ? toneOf(telemetry.gps.state) : "crit"}
            mono
            hint={telemetry.gps.validFix ? "Valid fix" : "Enforcement input suppressed"}
          />
          <Field label="Satellites" value={j.number(telemetry.gps.satellites)} mono />
          <Field label="HDOP" value={telemetry.gps.hdop.toFixed(1)} mono />
          <Field label="Accuracy" value={telemetry.gps.accuracy} tone={toneOf(telemetry.gps.accuracy)} mono />
        </Subsystem>

        <Subsystem title="Transport">
          <Field
            label="Network"
            value={telemetry.networkState.toUpperCase()}
            tone={toneOf(telemetry.networkState)}
            mono
          />
          <Field label="Bearer" value={telemetry.networkType} mono />
          <Field label="Signal" value={telemetry.signal} tone={toneOf(telemetry.signal)} mono />
          <Field
            label="Last heartbeat"
            value={elapsedSince(telemetry.heartbeatAt, now)}
            mono
            hint={j.time(telemetry.heartbeatAt)}
          />
        </Subsystem>

        <Subsystem title="Integrity">
          <Field
            label="Vehicle power"
            value={POWER_LABEL[telemetry.powerState]}
            tone={POWER_TONE[telemetry.powerState]}
            mono
            hint={telemetry.powerState === "loss" ? "Counts as an integrity event" : undefined}
          />
          <Field
            label="Backup power"
            value={`${j.number(telemetry.backupPower)}%`}
            tone={telemetry.powerState === "normal" ? undefined : "warn"}
            mono
          />
          <Field
            label="Tamper"
            value={telemetry.tamperState.replace(/_/g, " ").toUpperCase()}
            tone={telemetry.tamperState === "normal" ? "ok" : "tamper"}
            mono
          />
          <Field label="Firmware" value={device.firmware} mono hint={device.ruleVersion} />
        </Subsystem>

        <Subsystem title="Registry">
          <Field label="Device" value={device.id} mono />
          <Field label="Serial" value={device.serial} mono />
          <Field
            label="Fitment center"
            value={fitmentCenter?.name ?? device.fitmentCenterId}
            hint={fitmentCenter ? device.fitmentCenterId : undefined}
          />
          <Field label="Installed" value={j.date(device.installedAt)} mono />
        </Subsystem>
      </section>

      <section className="border-b border-[var(--line)] py-1.5">
        <p className="t-label px-3.5 py-1.5">Recent events</p>
        {events.length > 0 ? (
          <EventStream items={events.map((event) => ({ ...event, timestamp: j.time(event.timestamp) }))} />
        ) : (
          <EmptyState
            compact
            icon={<Radio className="h-4 w-4" />}
            title="No events for this vehicle"
            description="Feed entries and integrity events naming this registration or device will appear here."
          />
        )}
      </section>

      <section className="px-3.5 py-3.5">
        <p className="t-label mb-2">Location</p>
        <FieldGrid columns={2}>
          <Field label="Coordinates" value={formatCoords(telemetry.coordinates)} mono className="col-span-2" />
          <Field label="Road" value={telemetry.roadName} />
          <Field label="District" value={telemetry.district} />
        </FieldGrid>
      </section>
    </DetailPane>
  );
}

/** A labelled block of readings from one device subsystem. */
function Subsystem({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <div className="min-w-0">
      <p className="t-label mb-2">{title}</p>
      <FieldGrid columns={2}>{children}</FieldGrid>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* VehicleSummaryRow                                                          */
/* -------------------------------------------------------------------------- */

/**
 * One vehicle, one line: the densest honest summary of the record above.
 * Selection is brand-coloured and severity is status-coloured, so a selected
 * vehicle in violation still reads as both at once.
 */
export function VehicleSummaryRow({
  vehicle,
  selected,
  onSelect,
}: Readonly<{ vehicle: Vehicle; selected?: boolean; onSelect?: () => void }>) {
  const now = useSimulationStore((state) => state.now);
  const state = enforcementStateOf(vehicle);
  const tone = enforcementTone[state];
  const { telemetry } = vehicle;

  const content = (
    <>
      <StatusDot tone={tone} className="shrink-0" />
      <span className="t-reg w-[104px] shrink-0 truncate">{vehicle.registrationNumber}</span>
      <span className="t-meta min-w-0 flex-1 truncate">{telemetry.roadName}</span>
      <SpeedCell
        speed={telemetry.speed}
        limit={telemetry.roadLimit}
        tolerance={telemetry.tolerance}
        className="w-[68px] shrink-0"
      />
      <span className="t-mono-sm hidden w-[62px] shrink-0 text-right text-[var(--text-4)] sm:block">
        {elapsedSince(telemetry.heartbeatAt, now)}
      </span>
      <StatusBadge tone={tone} className="w-[82px] shrink-0 justify-center">
        {enforcementLabel[state]}
      </StatusBadge>
    </>
  );

  const layout = "flex w-full items-center gap-2.5 px-3 py-1.5 text-left";

  if (!onSelect) {
    return <div className={layout}>{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${vehicle.registrationNumber} · ${enforcementLabel[state]}`}
      className={cn(
        layout,
        "transition-colors duration-[var(--t-fast)] ease-[var(--ease)] hover:bg-[var(--panel-header)]",
        selected && "bg-[var(--brand-dimmer)] shadow-[inset_2px_0_0_var(--brand)]",
      )}
    >
      {content}
    </button>
  );
}

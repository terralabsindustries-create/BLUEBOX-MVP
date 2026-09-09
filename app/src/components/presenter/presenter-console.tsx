"use client";

import { Play, RotateCcw, Square } from "lucide-react";
import { Button, Segmented } from "@/components/ui/button";
import { Overlay } from "@/components/ui/drawer";
import { StatusBadge } from "@/components/ui/status";
import { Field, FieldGrid } from "@/components/ui/panel";
import { QualificationProgress, SpeedRuleScale } from "@/components/telemetry/speed-rule";
import { useSimulationStore } from "@/store/simulation-store";
import { speedRule } from "@/lib/rules/speed-rule";
import { useJurisdiction } from "@/lib/use-jurisdiction";
import { cn } from "@/lib/utils";

/**
 * PRESENTER CONSOLE
 *
 * This build is a demonstration system, and the single worst outcome would be a
 * stakeholder mistaking a simulated condition for a live reading. So the demo
 * controls are deliberately *not* mixed into the operational UI: they live in
 * one console, reached from a permanently-visible DEMO control in the top bar,
 * and every surface inside is marked as simulation.
 *
 * Every control here calls an existing store action. Nothing in this console
 * can do something the application cannot genuinely do — there are no buttons
 * that only look like features.
 */

/** Only the scenarios the store actually implements. */
const SCENARIOS = [
  { id: "normal", label: "Normal Traffic", detail: "Steady compliant driving, all subsystems healthy." },
  { id: "overspeed", label: "Overspeed Violation", detail: "Ramp past the trigger, sustain, qualify and sign evidence." },
  { id: "offline", label: "Device Offline", detail: "Lose the network, sign locally, queue, restore and upload." },
  { id: "tamper", label: "Device Tamper", detail: "Power loss then enclosure open — a critical integrity event." },
  { id: "gnss", label: "GNSS Degradation", detail: "Fix quality falls and enforcement input is suppressed." },
] as const;

export function PresenterConsole() {
  const j = useJurisdiction();
  const open = useSimulationStore((state) => state.demoControlsOpen);
  const toggle = useSimulationStore((state) => state.toggleDemoControls);
  const vehicle = useSimulationStore((state) => state.vehicles.find((item) => item.id === "vehicle-1"));
  const activeScenario = useSimulationStore((state) => state.scenario.active);
  const scenarioStep = useSimulationStore((state) => state.scenario.step);
  const simulationSpeed = useSimulationStore((state) => state.simulationSpeed);
  const qualificationSeconds = useSimulationStore((state) => state.qualificationSeconds);
  const qualificationActive = useSimulationStore((state) => state.qualificationActive);

  const setSpeed = useSimulationStore((state) => state.setSpeed);
  const setGpsState = useSimulationStore((state) => state.setGpsState);
  const setNetworkState = useSimulationStore((state) => state.setNetworkState);
  const setPowerState = useSimulationStore((state) => state.setPowerState);
  const setTamperState = useSimulationStore((state) => state.setTamperState);
  const generateHeartbeat = useSimulationStore((state) => state.generateHeartbeat);
  const clearDemo = useSimulationStore((state) => state.clearDemo);
  const resetSystem = useSimulationStore((state) => state.resetSystem);
  const triggerScenario = useSimulationStore((state) => state.triggerScenario);
  const setSimulationSpeed = useSimulationStore((state) => state.setSimulationSpeed);

  if (!vehicle) return null;

  const speed = vehicle.telemetry.speed;
  const { telemetry } = vehicle;

  // Presets are authored in km/h (the rule's unit) and shown converted, so an
  // imperial jurisdiction sees "Trigger 57 mph" rather than a stray metric value.
  const speedPresets = [
    { label: "Normal", kph: 60 },
    { label: "Near limit", kph: 83 },
    { label: "Trigger", kph: 92 },
    { label: "Severe", kph: 118 },
  ];

  const subsystems: {
    label: string;
    current: string;
    actions: { label: string; onClick: () => void; danger?: boolean }[];
  }[] = [
    {
      label: "GNSS",
      current: telemetry.gps.state,
      actions: [
        { label: "Valid", onClick: () => setGpsState("valid") },
        { label: "Poor", onClick: () => setGpsState("poor") },
        { label: "Lost", onClick: () => setGpsState("lost"), danger: true },
      ],
    },
    {
      label: "M2M Network",
      current: telemetry.networkState,
      actions: [
        { label: "Online", onClick: () => setNetworkState("online") },
        { label: "Offline", onClick: () => setNetworkState("offline"), danger: true },
        { label: "Restore", onClick: () => setNetworkState("restore") },
      ],
    },
    {
      label: "Power",
      current: telemetry.powerState,
      actions: [
        { label: "Normal", onClick: () => setPowerState("normal") },
        { label: "Loss", onClick: () => setPowerState("loss"), danger: true },
        { label: "Restore", onClick: () => setPowerState("restore") },
      ],
    },
    {
      label: "Tamper",
      current: telemetry.tamperState,
      actions: [
        { label: "Normal", onClick: () => setTamperState("normal") },
        { label: "Case open", onClick: () => setTamperState("case_open"), danger: true },
        { label: "Unplugged", onClick: () => setTamperState("device_unplugged"), danger: true },
        { label: "Firmware", onClick: () => setTamperState("firmware_integrity_failure"), danger: true },
      ],
    },
  ];

  return (
    <Overlay
      open={open}
      onClose={toggle}
      eyebrow="Simulation"
      title="Presenter Controls"
      description="Drives the live dashboard. Every control writes to the same state the operational screens read."
      width="max-w-[440px]"
      tone="warn"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <StatusBadge tone="warn" solid dot live={Boolean(activeScenario)}>
              Simulation active
            </StatusBadge>
          </span>
          <span className="flex gap-1.5">
            <Button size="sm" variant="ghost" onClick={clearDemo}>
              Clear
            </Button>
            <Button size="sm" variant="danger" onClick={resetSystem}>
              <RotateCcw className="h-3 w-3" />
              Reset system
            </Button>
          </span>
        </div>
      }
    >
      {/* Live readout — the operator watches this, not the dashboard behind. */}
      <section className="hatch-demo border-b border-[var(--line)] px-4 py-3.5">
        <SpeedRuleScale speed={speed} limit={telemetry.roadLimit} tolerance={telemetry.tolerance} />
        <div className="mt-4">
          <QualificationProgress
            seconds={qualificationSeconds}
            active={qualificationActive}
            speed={speed}
          />
        </div>
      </section>

      {/* Speed — the control that drives everything else. */}
      <section className="border-b border-[var(--line)] px-4 py-3.5">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <label htmlFor="presenter-speed" className="t-label">
            Road Speed
          </label>
          <span className="t-mono text-[15px] font-semibold text-[var(--text)]">
            {j.speedValue(speed)}
            <span className="ml-1 text-[10px] font-normal text-[var(--text-4)]">{j.speedUnitLabel}</span>
          </span>
        </div>
        <input
          id="presenter-speed"
          type="range"
          min={0}
          max={140}
          value={speed}
          onChange={(event) => setSpeed(Number(event.target.value))}
          className="range"
          style={{ "--range-progress": `${(speed / 140) * 100}%` } as React.CSSProperties}
          aria-valuetext={j.speed(speed)}
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {speedPresets.map((preset) => (
            <Button
              key={preset.label}
              size="xs"
              variant={Math.round(speed) === preset.kph ? "selected" : "secondary"}
              onClick={() => setSpeed(preset.kph)}
            >
              {preset.label}
              <span className="t-mono-sm text-[var(--text-4)]">{j.speedValue(preset.kph)}</span>
            </Button>
          ))}
        </div>
        <p className="mt-2 text-[10.5px] leading-snug text-[var(--text-4)]">
          Rule: limit {j.speed(speedRule.defaultRoadLimit)}, tolerance +{j.speedValue(speedRule.tolerance)}, qualify above{" "}
          {j.speed(speedRule.triggerSpeed)} sustained {speedRule.minimumViolationDuration}s.
          {j.speedUnit === "mph" ? " Rule thresholds are stored in km/h and converted for display." : ""}
        </p>
      </section>

      {/* Scenarios. */}
      <section className="border-b border-[var(--line)] px-4 py-3.5">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <p className="t-label">Scenario</p>
          <Segmented
            ariaLabel="Simulation speed"
            value={String(simulationSpeed) as "1" | "2" | "5"}
            onChange={(value) => setSimulationSpeed(Number(value) as 1 | 2 | 5)}
            options={[
              { value: "1", label: "1×" },
              { value: "2", label: "2×" },
              { value: "5", label: "5×" },
            ]}
          />
        </div>

        <ul className="space-y-1">
          {SCENARIOS.map((scenario) => {
            const active = activeScenario === scenario.id;
            return (
              <li key={scenario.id}>
                <button
                  type="button"
                  onClick={() => triggerScenario(scenario.id)}
                  aria-pressed={active}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-[var(--r-sm)] border px-2.5 py-2 text-left transition-colors duration-[var(--t-fast)]",
                    active
                      ? "border-[var(--brand-line)] bg-[var(--brand-dim)]"
                      : "border-[var(--line)] bg-[var(--panel-sunken)] hover:border-[var(--line-strong)] hover:bg-[var(--panel-header)]",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-[3px] grid h-4 w-4 flex-none place-items-center rounded-full border",
                      active ? "border-[var(--brand)] bg-[var(--brand)]" : "border-[var(--line-strong)]",
                    )}
                  >
                    {active ? (
                      <Square className="h-1.5 w-1.5 fill-[var(--brand-on)] text-[var(--brand-on)]" />
                    ) : (
                      <Play className="h-2 w-2 fill-[var(--text-4)] text-[var(--text-4)]" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block text-[12px] font-semibold",
                        active ? "text-[var(--brand-text)]" : "text-[var(--text)]",
                      )}
                    >
                      {scenario.label}
                    </span>
                    <span className="mt-0.5 block text-[10.5px] leading-snug text-[var(--text-4)]">
                      {scenario.detail}
                    </span>
                  </span>
                  {active ? (
                    <span className="t-mono-sm flex-none text-[var(--brand-text)]">
                      step {scenarioStep}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Subsystem overrides. */}
      <section className="border-b border-[var(--line)] px-4 py-3.5">
        <p className="t-label mb-2.5">Subsystem Override</p>
        <div className="space-y-2.5">
          {subsystems.map((group) => (
            <div key={group.label} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="w-[86px] flex-none">
                <span className="block text-[11px] font-medium text-[var(--text-2)]">{group.label}</span>
                <span className="t-mono-sm block truncate text-[var(--text-4)]">
                  {String(group.current).toUpperCase()}
                </span>
              </span>
              <span className="flex flex-1 flex-wrap gap-1">
                {group.actions.map((action) => (
                  <Button
                    key={action.label}
                    size="xs"
                    variant={action.danger ? "danger" : "secondary"}
                    onClick={action.onClick}
                  >
                    {action.label}
                  </Button>
                ))}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Direct event injection. */}
      <section className="border-b border-[var(--line)] px-4 py-3.5">
        <p className="t-label mb-2">Inject Event</p>
        <div className="flex flex-wrap gap-1.5">
          <Button size="xs" variant="secondary" onClick={generateHeartbeat}>
            Heartbeat
          </Button>
          <Button size="xs" variant="danger" onClick={() => setSpeed(92)}>
            Overspeed
          </Button>
          <Button size="xs" variant="danger" onClick={() => setNetworkState("offline")}>
            Network loss
          </Button>
          <Button size="xs" variant="danger" onClick={() => setGpsState("lost")}>
            GNSS loss
          </Button>
          <Button
            size="xs"
            variant="danger"
            onClick={() => window.dispatchEvent(new Event("bluebox:mock-physical-tamper"))}
            title="Sends a tamper event through the BLE bridge, as the ESP32 would"
          >
            Physical tamper
          </Button>
        </div>
      </section>

      {/* What the presenter is driving. */}
      <section className="px-4 py-3.5">
        <p className="t-label mb-2.5">Simulation Target</p>
        <FieldGrid columns={2}>
          <Field label="Vehicle" value={vehicle.registrationNumber} mono />
          <Field label="Device" value={vehicle.device.id} mono />
          <Field label="Road" value={telemetry.roadName} />
          <Field label="Firmware" value={vehicle.device.firmware} mono />
        </FieldGrid>
        <p className="mt-3 text-[10.5px] leading-snug text-[var(--text-4)]">
          Controls drive one instrumented vehicle. Fleet-wide figures elsewhere in the dashboard are a fixed
          demonstration dataset and do not respond to these controls.
        </p>
      </section>
    </Overlay>
  );
}

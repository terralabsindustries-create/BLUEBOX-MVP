"use client";

import { AlertTriangle, MonitorPlay } from "lucide-react";
import { Page, PageBody, PageHeader, HeaderStat } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHead, Section } from "@/components/ui/panel";
import { Button, Segmented } from "@/components/ui/button";
import { ReadOnlyValue, SettingRow } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status";
import { ConditionState } from "@/components/ui/states";
import { SpeedRuleScale } from "@/components/telemetry/speed-rule";
import { TransportPanel } from "@/components/layout/bridge-status";
import { copyFor } from "@/components/layout/nav-config";
import { useSimulationStore } from "@/store/simulation-store";
import { useJurisdiction } from "@/lib/use-jurisdiction";
import { speedRule } from "@/lib/rules/speed-rule";
import { PHYSICAL_BLUEBOX } from "@/lib/physical-bluebox-protocol";

/**
 * SETTINGS
 *
 * Configuration for critical infrastructure, grouped by subsystem rather than
 * poured into one long form.
 *
 * Almost everything here is read-only, and that is deliberate: in this build
 * these values are fixed by the deployment, and rendering them as editable
 * inputs would tell an evaluator the platform supports runtime changes it does
 * not. A locked value is honest; a text field that silently discards input is
 * not.
 */
export function SystemSettingsPage() {
  const copy = copyFor("/system-settings");
  const j = useJurisdiction();
  const bridgeMode = useSimulationStore((state) => state.bridgeMode);
  const simulationSpeed = useSimulationStore((state) => state.simulationSpeed);
  const setSimulationSpeed = useSimulationStore((state) => state.setSimulationSpeed);
  const toggleDemoControls = useSimulationStore((state) => state.toggleDemoControls);
  const resetSystem = useSimulationStore((state) => state.resetSystem);

  const uuids: [string, string][] = [
    ["Service", PHYSICAL_BLUEBOX.serviceUuid],
    ["State", PHYSICAL_BLUEBOX.stateCharacteristicUuid],
    ["Event", PHYSICAL_BLUEBOX.eventCharacteristicUuid],
    ["Command", PHYSICAL_BLUEBOX.commandCharacteristicUuid],
    ["Health", PHYSICAL_BLUEBOX.healthCharacteristicUuid],
    ["ACK", PHYSICAL_BLUEBOX.ackCharacteristicUuid],
  ];

  return (
    <Page>
      <PageHeader
        group={copy.group}
        title={copy.title}
        description={copy.description}
        status={
          <>
            <HeaderStat label="Jurisdiction" value={j.label} />
            <HeaderStat label="Rule" value={speedRule.ruleVersion} />
          </>
        }
        actions={<StatusBadge tone="warn">{j.environment}</StatusBadge>}
      />

      <PageBody>
        {/* 1 — Deployment */}
        <Section title="Deployment" description="Switched from the jurisdiction control in the top bar">
          <Panel>
            <PanelHead title="Jurisdiction" meta={j.id} />
            <div>
              <SettingRow label="Authority" description="Body operating this deployment" control={<ReadOnlyValue value={j.authorityName} mono={false} />} />
              <SettingRow label="Region" control={<ReadOnlyValue value={j.label} mono={false} />} />
              <SettingRow label="Environment" description="Demonstration deployments are labelled throughout the interface" control={<StatusBadge tone="warn">{j.environment}</StatusBadge>} />
              <SettingRow label="Locale" control={<ReadOnlyValue value={j.locale} />} />
              <SettingRow label="Timezone" control={<ReadOnlyValue value={`${j.timezone} · ${j.timezoneLabel}`} />} />
              <SettingRow label="Speed unit" description="Display only — telemetry and the rule remain in km/h" control={<ReadOnlyValue value={j.speedUnitLabel} />} />
              <SettingRow
                label="Currency"
                description={`Sample formatting: ${j.currency(1000)}`}
                control={<ReadOnlyValue value={j.config.currency} />}
              />
              <SettingRow label="Registration format" control={<ReadOnlyValue value={`${j.registrationFormat} · ${j.registrationExample}`} />} />
              <SettingRow label="Notice type" description="Local term for an enforcement notice" control={<ReadOnlyValue value={j.noticeTerm} mono={false} />} />
              <SettingRow label="Issuing office" control={<ReadOnlyValue value={j.issuingOffice} mono={false} />} />
            </div>
          </Panel>
        </Section>

        {/* 2 — Enforcement policy */}
        <Section title="Enforcement policy" description="Applied locally on every device before an event can qualify">
          <div className="grid gap-3 lg:grid-cols-[1fr_1.1fr]">
            <Panel>
              <PanelHead title="Speed rule" meta={speedRule.ruleVersion} />
              <div>
                <SettingRow label="Default road limit" control={<ReadOnlyValue value={j.speed(speedRule.defaultRoadLimit)} />} />
                <SettingRow label="Tolerance" description="Applied above the limit before the rule engages" control={<ReadOnlyValue value={`+ ${j.speed(speedRule.tolerance)}`} />} />
                <SettingRow label="Trigger speed" description="Sustained speed above which qualification begins" control={<ReadOnlyValue value={j.speed(speedRule.triggerSpeed)} />} />
                <SettingRow label="Minimum duration" description="A brief spike never creates an event" control={<ReadOnlyValue value={`${speedRule.minimumViolationDuration}.0 s`} />} />
                <SettingRow label="GNSS gate" description="Enforcement is suppressed without a valid fix" control={<StatusBadge tone="ok">Enforced</StatusBadge>} />
              </div>
            </Panel>

            <Panel>
              <PanelHead title="Threshold bands" />
              <PanelBody pad="md">
                <SpeedRuleScale speed={speedRule.triggerSpeed} />
                <ConditionState
                  tone="info"
                  title="The device never determines a penalty"
                  description="It detects a condition, qualifies it against these thresholds and signs an evidence record. A backend verifies that record. Any consequence is decided by authority enforcement policy."
                  className="mt-4"
                />
              </PanelBody>
            </Panel>
          </div>
        </Section>

        {/* 3 — Connectivity */}
        <Section title="Connectivity" description="Local bridge and demonstration transports">
          <Panel>
            <PanelHead
              title="Transport"
              actions={
                <StatusBadge tone={bridgeMode === "real" ? "ok" : bridgeMode === "mock" ? "warn" : "idle"}>
                  {bridgeMode === "real" ? "Live BLE" : bridgeMode === "mock" ? "Mock BLE" : "No bridge"}
                </StatusBadge>
              }
            />
            <TransportPanel />
            <div className="border-t border-[var(--line)]">
              <SettingRow label="Bridge endpoint" control={<ReadOnlyValue value="ws://localhost:8765" />} />
              <SettingRow
                label="BLE role"
                description="BLE is the tabletop demonstration transport only. The simulated M2M network is a separate, independent state."
                control={<ReadOnlyValue value="Laptop bridge — synchronisation authority" mono={false} />}
              />
            </div>
          </Panel>
        </Section>

        {/* 4 — Device protocol */}
        <Section title="Device protocol" description="ESP32 physical BlueBox identity and GATT characteristics">
          <Panel>
            <PanelHead title="BLE identity" meta={PHYSICAL_BLUEBOX.deviceId} />
            <div>
              <SettingRow label="Advertised name" control={<ReadOnlyValue value={PHYSICAL_BLUEBOX.advertisedName} />} />
              <SettingRow label="Device ID" control={<ReadOnlyValue value={PHYSICAL_BLUEBOX.deviceId} />} />
              <SettingRow label="Linked vehicle" control={<ReadOnlyValue value={PHYSICAL_BLUEBOX.linkedVehicle} />} />
              {uuids.map(([label, uuid]) => (
                <SettingRow key={label} label={`${label} characteristic`} control={<ReadOnlyValue value={uuid} />} />
              ))}
            </div>
          </Panel>
        </Section>

        {/* 5 — Evidence */}
        <Section title="Evidence" description="What the device produces and what the backend checks">
          <Panel>
            <PanelHead title="Integrity" />
            <div>
              <SettingRow label="Signing" description="Every qualified event is signed on the device before transmission" control={<StatusBadge tone="ok">On device</StatusBadge>} />
              <SettingRow label="Rule validation" description="Thresholds and sustain duration re-evaluated server-side" control={<StatusBadge tone="ok">Backend gate</StatusBadge>} />
              <SettingRow label="GNSS quality check" description="Fix validity and dilution of precision at capture" control={<StatusBadge tone="ok">Backend gate</StatusBadge>} />
              <SettingRow label="Duplicate check" description="Event sequence reconciled against the device register" control={<StatusBadge tone="ok">Backend gate</StatusBadge>} />
              <SettingRow label="Signature verification" description="Checked against the device's registered identity" control={<StatusBadge tone="ok">Backend gate</StatusBadge>} />
              <SettingRow
                label="Penalty determination"
                description="Not a device function and not a dashboard function"
                control={<ReadOnlyValue value="Authority policy" mono={false} />}
              />
            </div>
          </Panel>
        </Section>

        {/* 6 — Data */}
        <Section title="Data and retention">
          <Panel>
            <PanelHead title="Storage" />
            <div>
              <SettingRow label="Dashboard persistence" description="Session state is held in browser localStorage on this machine only" control={<ReadOnlyValue value="localStorage" />} />
              <SettingRow label="Dataset" description="All figures in this build are simulated demonstration data" control={<StatusBadge tone="warn">Simulated</StatusBadge>} />
              <SettingRow label="Retention scope" description="Cleared by resetting the system or clearing browser data" control={<ReadOnlyValue value="Session" mono={false} />} />
            </div>
          </Panel>
        </Section>

        {/* 7 — Presenter */}
        <Section title="Presenter mode" description="Demonstration controls, kept separate from operational surfaces">
          <Panel>
            <PanelHead title="Simulation" icon={<MonitorPlay className="h-3.5 w-3.5" />} />
            <div>
              <SettingRow
                label="Presenter console"
                description="Scenarios, subsystem overrides and event injection"
                control={
                  <Button size="sm" variant="secondary" onClick={toggleDemoControls}>
                    Open console
                  </Button>
                }
              />
              <SettingRow
                label="Simulation speed"
                description="Shortens the tick interval. The rule still evaluates every simulated second — it is never fast-forwarded past."
                control={
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
                }
              />
            </div>
          </Panel>
        </Section>

        {/* 8 — Danger zone */}
        <Section title="System">
          <Panel tone="crit">
            <PanelHead title="Destructive actions" icon={<AlertTriangle className="h-3.5 w-3.5" />} />
            <div>
              <SettingRow
                danger
                label="Reset system"
                description="Discards all session state — telemetry, evidence records, notices, tamper events, the audit trail and the offline queue — and reseeds the demonstration dataset. This cannot be undone."
                control={
                  <Button size="sm" variant="danger" onClick={resetSystem}>
                    Reset system
                  </Button>
                }
              />
            </div>
          </Panel>
        </Section>
      </PageBody>
    </Page>
  );
}

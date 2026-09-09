"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, CloudOff, ShieldCheck } from "lucide-react";
import { Page, PageBody, PageHeader, HeaderStat } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHead, Section } from "@/components/ui/panel";
import { MetricCell, MetricStrip, Readout, StatusHeadline } from "@/components/ui/metric";
import { DataTable, IdentityCell, SpeedCell } from "@/components/ui/data-table";
import { LinkButton } from "@/components/ui/button";
import { StatusBadge, Meter, StatusDot } from "@/components/ui/status";
import { EmptyState } from "@/components/ui/states";
import { OperationsMap, type MapLayer } from "@/components/map/operations-map";
import { ActivityFeed } from "@/components/panels/activity-feed";
import { ViolationTrendChart } from "@/components/panels/charts";
import { EvidenceDrawer } from "@/components/violations/evidence-drawer";
import { copyFor } from "@/components/layout/nav-config";
import { useSimulationStore } from "@/store/simulation-store";
import { useJurisdiction } from "@/lib/use-jurisdiction";
import {
  type EnforcementState,
  type OperationalTone,
  enforcementLabel,
  enforcementRank,
  enforcementTone,
} from "@/lib/status";
import { elapsedSince, enforcementStateOf } from "@/lib/utils";

/**
 * THE COMMAND CENTER
 *
 * Ordered by consequence, not by widget. An operator opening this screen asks,
 * in this order: is the network all right, what needs me right now, where is it
 * happening, and what just changed. So the page answers in that order — a
 * verdict first, then the triage list, then the map, then the log.
 *
 * The old design opened with six identical KPI cards, which is the layout that
 * makes every number look equally urgent and therefore makes none of them
 * urgent. Here the headline verdict is derived from the worst live condition,
 * and the supporting counters are a single hairline-divided strip beneath it.
 */
export function OverviewPage() {
  const copy = copyFor("/dashboard");
  const j = useJurisdiction();
  const [layer, setLayer] = useState<MapLayer>("all");

  const now = useSimulationStore((state) => state.now);
  const vehicles = useSimulationStore((state) => state.vehicles);
  const violations = useSimulationStore((state) => state.violations);
  const tamperEvents = useSimulationStore((state) => state.tamperEvents);
  const deviceHealth = useSimulationStore((state) => state.deviceHealth);
  const offlineQueue = useSimulationStore((state) => state.offlineQueue);
  const uploadSequence = useSimulationStore((state) => state.uploadSequence);
  const metrics = useSimulationStore((state) => state.metrics);
  const selectVehicle = useSimulationStore((state) => state.selectVehicle);

  const states = useMemo(
    () => vehicles.map((vehicle) => ({ vehicle, state: enforcementStateOf(vehicle) })),
    [vehicles],
  );

  const counts = useMemo(() => {
    const result: Record<EnforcementState, number> = {
      normal: 0,
      near: 0,
      overspeed: 0,
      violation: 0,
      offline: 0,
      tamper: 0,
    };
    for (const entry of states) result[entry.state] += 1;
    return result;
  }, [states]);

  /**
   * The triage list. Sorted by operational priority rather than by time,
   * because "what should I look at first" is the question this screen exists
   * to answer — and a tamper event three minutes old outranks an overspeed
   * three seconds old.
   */
  const attention = useMemo(
    () =>
      states
        .filter((entry) => entry.state !== "normal")
        .sort((a, b) => enforcementRank[b.state] - enforcementRank[a.state])
        .slice(0, 8),
    [states],
  );

  const openTamper = tamperEvents.filter((event) => event.status === "Open").length;
  const criticalTamper = tamperEvents.filter(
    (event) => event.status === "Open" && event.severity === "Critical",
  ).length;
  const pendingEvidence = violations.filter((item) => item.uploadStatus !== "UPLOADED").length;
  const healthy = deviceHealth.filter((row) => row.health === "Healthy").length;
  const readiness = deviceHealth.length > 0 ? (healthy / deviceHealth.length) * 100 : 0;
  const uploading = uploadSequence.length > 0 && uploadSequence[0] !== "Waiting for connectivity";

  /**
   * One verdict, derived from the worst live condition. Integrity outranks
   * speed, and speed outranks connectivity — the same precedence the
   * enforcement state itself uses, so the headline can never contradict the
   * rows beneath it.
   */
  const verdict: { headline: string; tone: OperationalTone; detail: string } = criticalTamper > 0
    ? {
        headline: "Critical — integrity",
        tone: "tamper",
        detail: `${criticalTamper} open critical tamper event${criticalTamper === 1 ? " requires" : "s require"} physical inspection. Device integrity is the highest-priority condition on the network.`,
      }
    : counts.overspeed > 0
      ? {
          headline: "Attention required",
          tone: "crit",
          detail: `${counts.overspeed} vehicle${counts.overspeed === 1 ? " is" : "s are"} above the qualification threshold. Evidence is created only after the threshold is sustained.`,
        }
      : counts.tamper > 0 || openTamper > 0
        ? {
            headline: "Attention required",
            tone: "warn",
            detail: `${openTamper} tamper event${openTamper === 1 ? "" : "s"} awaiting triage. No vehicle is currently above the qualification threshold.`,
          }
        : counts.offline > 0
          ? {
              headline: "Operational — degraded",
              tone: "warn",
              detail: `${counts.offline} device${counts.offline === 1 ? " is" : "s are"} without a network route and are queuing evidence locally. No evidence is lost while offline.`,
            }
          : {
              headline: "Operational",
              tone: "ok",
              detail:
                "All reporting devices are within policy thresholds, with valid GNSS fixes and an active network route.",
            };

  return (
    <Page>
      <PageHeader
        group={copy.group}
        title={copy.title}
        description={copy.description}
        status={
          <>
            <HeaderStat label="Tracked" value={j.number(vehicles.length)} />
            <HeaderStat
              label="Attention"
              value={j.number(attention.length)}
              tone={attention.length > 0 ? "warn" : "ok"}
            />
            <HeaderStat label="Queued" value={j.number(offlineQueue.length)} />
          </>
        }
        actions={
          <LinkButton href="/violations" size="sm" variant="secondary">
            Evidence register
            <ArrowUpRight className="h-3.5 w-3.5" />
          </LinkButton>
        }
      />

      <PageBody>
        {/* 1 — The verdict, and the counters that justify it. */}
        <Panel tone={verdict.tone === "ok" ? "ok" : verdict.tone === "tamper" ? "tamper" : verdict.tone === "crit" ? "crit" : "warn"}>
          <PanelBody pad="md">
            <StatusHeadline
              state="Road network status"
              headline={verdict.headline}
              tone={verdict.tone}
              detail={verdict.detail}
              aside={
                <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
                  <Readout label="Active" value={j.number(vehicles.length - counts.offline)} />
                  <Readout label="Connected" value={j.number(metrics.onlineDevices)} />
                  <Readout
                    label="Violations today"
                    value={j.number(metrics.violationsToday)}
                    tone={metrics.violationsToday > 0 ? "crit" : undefined}
                  />
                  <Readout
                    label="Offline"
                    value={j.number(counts.offline)}
                    tone={counts.offline > 0 ? "idle" : undefined}
                  />
                </div>
              }
            />
          </PanelBody>
        </Panel>

        {/* 2 — Registry counters. Each cell links to the screen that acts on it:
               an operator who reads "3 tamper alerts" should be one click from
               triaging them, not hunting the rail for the route. */}
        <MetricStrip>
          <MetricCell
            label="Active vehicles"
            value={j.number(vehicles.length - counts.offline)}
            caption={`${j.number(vehicles.length)} in registry`}
            href="/live-vehicles"
          />
          <MetricCell
            label="Devices connected"
            value={j.number(metrics.onlineDevices)}
            caption={`of ${j.number(metrics.totalDevices)}`}
            tone="ok"
            href="/device-health"
          />
          <MetricCell
            label="Violations today"
            value={j.number(metrics.violationsToday)}
            caption="Signed enforcement inputs"
            tone="crit"
            href="/violations"
          />
          <MetricCell
            label="Awaiting verification"
            value={j.number(pendingEvidence)}
            caption="Not yet backend verified"
            tone={pendingEvidence > 0 ? "warn" : "ok"}
            href="/violations"
          />
          <MetricCell
            label="Offline devices"
            value={j.number(counts.offline)}
            caption="Queuing evidence locally"
            tone={counts.offline > 0 ? "idle" : "ok"}
            href="/offline-devices"
          />
          <MetricCell
            label="Tamper alerts"
            value={j.number(openTamper)}
            caption={criticalTamper > 0 ? `${criticalTamper} critical` : "Open incidents"}
            tone={openTamper > 0 ? "tamper" : "ok"}
            href="/tamper-events"
          />
        </MetricStrip>

        {/* 3 — Live operations. The map dominates; the log runs beside it. */}
        <Section title="Live operations" description={j.label}>
          <div className="grid gap-3 xl:grid-cols-[1.7fr_1fr]">
            <Panel className="min-h-[380px]">
              <PanelHead
                title="Operations map"
                meta={`${j.number(vehicles.length)} tracked`}
                actions={
                  <LinkButton href="/map-heatmap" size="xs" variant="ghost">
                    Full map
                    <ArrowUpRight className="h-3 w-3" />
                  </LinkButton>
                }
              />
              <PanelBody pad="none" className="flex-1">
                <OperationsMap layer={layer} onLayerChange={setLayer} className="h-full min-h-[340px]" />
              </PanelBody>
            </Panel>

            <ActivityFeed limit={14} className="min-h-[380px] xl:max-h-[440px]" />
          </div>
        </Section>

        {/* 4 — Triage. */}
        <Section
          title="Attention required"
          description="Ordered by operational priority"
          actions={
            <LinkButton href="/live-vehicles" size="xs" variant="ghost">
              All vehicles
              <ArrowUpRight className="h-3 w-3" />
            </LinkButton>
          }
        >
          <Panel>
            <DataTable
              caption="Vehicles and devices requiring attention"
              rows={attention}
              rowKey={(row) => row.vehicle.id}
              onRowClick={(row) => selectVehicle(row.vehicle.id)}
              severityOf={(row) =>
                row.state === "tamper" ? "tamper" : row.state === "overspeed" ? "crit" : "warn"
              }
              density="relaxed"
              emptyState={
                <EmptyState
                  compact
                  tone="ok"
                  icon={<ShieldCheck className="h-4 w-4" />}
                  title="All vehicles nominal"
                  description="Every reporting device is within policy thresholds with a valid GNSS fix and an active network route."
                />
              }
              columns={[
                {
                  key: "vehicle",
                  header: "Vehicle",
                  render: (row) => (
                    <IdentityCell title={row.vehicle.registrationNumber} subtitle={row.vehicle.device.id} />
                  ),
                },
                {
                  key: "state",
                  header: "State",
                  render: (row) => (
                    <StatusBadge
                      tone={enforcementTone[row.state]}
                      solid={row.state === "tamper"}
                      dot
                      live={row.state === "overspeed" || row.state === "tamper"}
                    >
                      {enforcementLabel[row.state]}
                    </StatusBadge>
                  ),
                },
                {
                  key: "speed",
                  header: "Speed",
                  variant: "num",
                  render: (row) =>
                    row.state === "offline" ? (
                      <span className="t-mono-sm text-[var(--text-4)]">—</span>
                    ) : (
                      <SpeedCell
                        speed={row.vehicle.telemetry.speed}
                        limit={row.vehicle.telemetry.roadLimit}
                        tolerance={row.vehicle.telemetry.tolerance}
                      />
                    ),
                },
                {
                  key: "location",
                  header: "Location",
                  hideBelow: "md",
                  render: (row) => <span className="t-meta">{row.vehicle.telemetry.roadName}</span>,
                },
                {
                  key: "signal",
                  header: "Last signal",
                  hideBelow: "lg",
                  render: (row) => (
                    <span className="t-mono-sm text-[var(--text-3)]">
                      {elapsedSince(row.vehicle.telemetry.heartbeatAt, now)}
                    </span>
                  ),
                },
              ]}
            />
          </Panel>
        </Section>

        {/* 5 — Supporting instruments. */}
        <div className="grid gap-3 lg:grid-cols-3">
          <Panel>
            <PanelHead title="Device health" icon={<ShieldCheck className="h-3.5 w-3.5" />} />
            <PanelBody pad="md">
              <div className="flex items-baseline justify-between gap-3">
                <p className="t-metric text-[var(--text)]">{readiness.toFixed(1)}%</p>
                <p className="t-mono-sm text-[var(--text-4)]">
                  {j.number(healthy)} / {j.number(deviceHealth.length)}
                </p>
              </div>
              <Meter
                value={readiness}
                tone={readiness > 95 ? "ok" : readiness > 85 ? "warn" : "crit"}
                label="Fleet operational readiness"
                className="mt-2"
              />
              <ul className="mt-3 space-y-1">
                {(
                  [
                    ["Warning", "Warning", "warn"],
                    ["Offline", "Offline", "idle"],
                    ["Tamper", "Tamper", "tamper"],
                  ] as const
                ).map(([label, key, tone]) => {
                  const value = deviceHealth.filter((row) => row.health === key).length;
                  return (
                    <li key={key} className="flex items-center gap-2">
                      <StatusDot tone={tone} />
                      <span className="t-meta flex-1">{label}</span>
                      <span className="t-num text-[12px] font-semibold text-[var(--text)]">{j.number(value)}</span>
                    </li>
                  );
                })}
              </ul>
            </PanelBody>
          </Panel>

          <ViolationTrendChart height={168} />

          <Panel tone={offlineQueue.length > 0 ? "warn" : undefined}>
            <PanelHead title="Sync queue" icon={<CloudOff className="h-3.5 w-3.5" />} />
            <PanelBody pad="md">
              <div className="flex items-baseline justify-between gap-3">
                <p className="t-metric text-[var(--text)]">{j.number(offlineQueue.length)}</p>
                <span className="t-mono-sm text-[var(--text-4)]">
                  event{offlineQueue.length === 1 ? "" : "s"} held locally
                </span>
              </div>

              {uploading ? (
                <>
                  <p className="t-meta mt-2 truncate text-[var(--info-text)]">{uploadSequence[0]}</p>
                  <span className="progress-indeterminate mt-2 block" />
                </>
              ) : (
                <p className="t-meta mt-2 leading-snug">
                  {offlineQueue.length > 0
                    ? "Signed locally and held until a network route returns. Nothing is discarded and nothing is re-signed on reconnection."
                    : "No evidence is currently held offline. Every device has a route to the backend."}
                </p>
              )}

              <LinkButton href="/offline-devices" size="xs" variant="ghost" className="mt-3 -ml-2">
                Offline queue
                <ArrowUpRight className="h-3 w-3" />
              </LinkButton>
            </PanelBody>
          </Panel>
        </div>
      </PageBody>

      <EvidenceDrawer />
    </Page>
  );
}

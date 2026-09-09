"use client";

import { useMemo } from "react";
import { CloudOff, Wifi } from "lucide-react";
import { Page, PageBody, PageHeader, HeaderStat } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHead, Section } from "@/components/ui/panel";
import { DataTable, IdentityCell } from "@/components/ui/data-table";
import { Readout } from "@/components/ui/metric";
import { Meter, StatusBadge, StatusDot } from "@/components/ui/status";
import { EmptyState } from "@/components/ui/states";
import { Timeline, type TimelineStep } from "@/components/ui/timeline";
import { EvidenceDrawer } from "@/components/violations/evidence-drawer";
import { copyFor } from "@/components/layout/nav-config";
import { useSimulationStore } from "@/store/simulation-store";
import { useJurisdiction } from "@/lib/use-jurisdiction";
import { toneOf } from "@/lib/status";
import { cn, elapsedSince } from "@/lib/utils";

/**
 * OFFLINE-FIRST
 *
 * This is the product's differentiating claim, and the screen has to make it
 * legible to someone who is not an engineer: when the network goes, the device
 * keeps measuring, keeps applying the rule, keeps signing — and nothing is
 * lost, re-signed or silently dropped when the route comes back.
 *
 * So the page leads with the lifecycle rather than with a device list. The
 * device list is the supporting evidence; the lifecycle is the argument.
 */
export function OfflineDevicesPage() {
  const copy = copyFor("/offline-devices");
  const j = useJurisdiction();
  const now = useSimulationStore((state) => state.now);
  const vehicles = useSimulationStore((state) => state.vehicles);
  const offlineQueue = useSimulationStore((state) => state.offlineQueue);
  const uploadSequence = useSimulationStore((state) => state.uploadSequence);
  const selectViolation = useSimulationStore((state) => state.selectViolation);

  const offlineVehicles = useMemo(
    () => vehicles.filter((vehicle) => vehicle.telemetry.networkState === "offline"),
    [vehicles],
  );

  const waiting = uploadSequence[0] === "Waiting for connectivity";
  const syncing = uploadSequence.length > 0 && !waiting;
  const queued = offlineQueue.length;
  const uploaded = offlineQueue.filter((item) => item.status === "UPLOADED").length;

  /**
   * The lifecycle, driven by real state rather than a fixed illustration: an
   * operator watching a demonstration sees these steps advance as the network
   * actually drops and returns.
   */
  const lifecycle: TimelineStep[] = [
    {
      label: "Online",
      detail: `${j.number(vehicles.length - offlineVehicles.length)} devices with a route`,
      state: "done",
    },
    {
      label: "Connection lost",
      detail: offlineVehicles.length > 0 ? `${j.number(offlineVehicles.length)} devices offline` : "None currently",
      state: offlineVehicles.length > 0 ? "active" : "pending",
    },
    {
      label: "Local queue",
      detail: queued > 0 ? `${j.number(queued)} signed events held on device` : "Nothing held locally",
      state: queued > 0 ? (syncing ? "done" : "active") : "pending",
    },
    {
      label: "Restored",
      detail: syncing ? "Route returned" : waiting ? "Waiting for connectivity" : "No restoration in progress",
      state: syncing ? "done" : waiting ? "blocked" : "pending",
    },
    {
      label: "Syncing",
      detail: syncing ? uploadSequence[0] : "Idle",
      state: syncing ? "active" : "pending",
    },
    {
      label: "Verified",
      detail: uploaded > 0 ? `${j.number(uploaded)} uploaded and acknowledged` : "Awaiting backend verification",
      state: uploaded > 0 ? "done" : "pending",
    },
  ];

  return (
    <Page>
      <PageHeader
        group={copy.group}
        title={copy.title}
        description={copy.description}
        status={
          <>
            <HeaderStat label="Offline" value={j.number(offlineVehicles.length)} tone={offlineVehicles.length > 0 ? "warn" : "ok"} />
            <HeaderStat label="Queued events" value={j.number(queued)} tone={queued > 0 ? "warn" : "ok"} />
            <HeaderStat label="Sync" value={syncing ? "Active" : "Idle"} tone={syncing ? "warn" : "ok"} />
          </>
        }
      />

      <PageBody>
        <Panel tone={queued > 0 ? "warn" : undefined}>
          <PanelHead title="Evidence recovery lifecycle" icon={<CloudOff className="h-3.5 w-3.5" />} />
          <PanelBody pad="md">
            <Timeline steps={lifecycle} orientation="horizontal" />
          </PanelBody>
        </Panel>

        <div className="grid gap-3 lg:grid-cols-[1fr_1.1fr]">
          <Panel>
            <PanelBody pad="md">
              <p className="t-label">Local evidence queue</p>
              <p className="mt-1.5 flex items-baseline gap-2">
                <span className="t-metric-lg">{j.number(queued)}</span>
                <span className="t-mono-sm text-[var(--text-4)]">
                  signed event{queued === 1 ? "" : "s"} held on device
                </span>
              </p>
              <p className="t-meta mt-2.5 leading-relaxed">
                With no network route, GNSS monitoring, the local speed rule and event signing all continue. Evidence
                is written to device storage and held there. Nothing is discarded while offline, and nothing is
                re-signed on reconnection — the record that uploads is the record the device created.
              </p>

              <div className="mt-3 flex flex-wrap gap-x-7 gap-y-3 border-t border-[var(--line-soft)] pt-3">
                <Readout label="Devices offline" value={j.number(offlineVehicles.length)} tone={offlineVehicles.length > 0 ? "idle" : "ok"} />
                <Readout label="Protection" value="Active" tone="ok" />
                <Readout label="Uploaded" value={j.number(uploaded)} tone="ok" />
              </div>
            </PanelBody>
          </Panel>

          <Panel tone={syncing ? "warn" : undefined}>
            <PanelHead
              title="Upload sequence"
              icon={<Wifi className="h-3.5 w-3.5" />}
              actions={
                <StatusBadge tone={syncing ? "info" : waiting ? "warn" : "idle"} dot live={syncing}>
                  {syncing ? "Syncing" : waiting ? "Waiting" : "Idle"}
                </StatusBadge>
              }
            />
            <PanelBody pad="md">
              {uploadSequence.length === 0 ? (
                <EmptyState
                  compact
                  tone="ok"
                  icon={<Wifi className="h-4 w-4" />}
                  title="No upload in progress"
                  description="Queued evidence uploads automatically the moment a network route returns."
                />
              ) : (
                <>
                  <ol className="space-y-1.5">
                    {uploadSequence.map((step, index) => (
                      <li key={step} className="flex items-center gap-2.5">
                        <StatusDot tone={index === 0 ? "info" : "idle"} live={index === 0 && syncing} />
                        <span
                          className={cn(
                            "text-[12px]",
                            index === 0 ? "font-medium text-[var(--text)]" : "text-[var(--text-4)]",
                          )}
                        >
                          {step}
                        </span>
                      </li>
                    ))}
                  </ol>
                  {syncing ? <span className="progress-indeterminate mt-3 block" /> : null}
                </>
              )}
            </PanelBody>
          </Panel>
        </div>

        {queued > 0 ? (
          <Section title="Queued events" description="Signed locally and held until a route returns">
            <Panel>
              <DataTable
                caption="Locally queued evidence"
                rows={offlineQueue}
                rowKey={(row) => row.id}
                onRowClick={(row) => selectViolation(row.violationId)}
                columns={[
                  { key: "id", header: "Queue ID", variant: "mono", render: (row) => row.id },
                  {
                    key: "violation",
                    header: "Evidence record",
                    variant: "mono",
                    render: (row) => <span className="text-[var(--brand-text)]">{row.violationId}</span>,
                  },
                  {
                    key: "created",
                    header: "Created",
                    hideBelow: "sm",
                    render: (row) => <span className="t-mono-sm text-[var(--text-3)]">{j.time(row.createdAt)}</span>,
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (row) => (
                      <StatusBadge tone={toneOf(row.status)} dot live={row.status === "UPLOADING"}>
                        {row.status}
                      </StatusBadge>
                    ),
                  },
                ]}
              />
            </Panel>
          </Section>
        ) : null}

        <Section title="Devices under watch" description="Non-reporting devices currently holding evidence locally">
          <Panel>
            <DataTable
              caption="Devices without a network route"
              rows={offlineVehicles}
              rowKey={(row) => row.id}
              density="relaxed"
              emptyState={
                <EmptyState
                  tone="ok"
                  icon={<Wifi className="h-4 w-4" />}
                  title="Every device has a network route"
                  description="No device in the fleet is currently offline. Simulate a network loss from the presenter console to watch the queue behaviour."
                />
              }
              columns={[
                {
                  key: "vehicle",
                  header: "Vehicle",
                  sortBy: (row) => row.registrationNumber,
                  render: (row) => <IdentityCell title={row.registrationNumber} subtitle={row.ownerName} />,
                },
                {
                  key: "device",
                  header: "Device",
                  variant: "mono",
                  hideBelow: "sm",
                  render: (row) => row.device.id,
                },
                {
                  key: "since",
                  header: "Last heartbeat",
                  hideBelow: "md",
                  sortBy: (row) => row.telemetry.heartbeatAt,
                  render: (row) => (
                    <span className="t-mono-sm text-[var(--text-3)]">
                      {elapsedSince(row.telemetry.heartbeatAt, now)}
                    </span>
                  ),
                },
                {
                  key: "location",
                  header: "Last known location",
                  hideBelow: "lg",
                  render: (row) => <span className="t-meta">{row.telemetry.roadName}</span>,
                },
                {
                  key: "storage",
                  header: "Storage",
                  hideBelow: "xl",
                  sortBy: (row) => row.device.storageUsed,
                  render: (row) => (
                    <span className="flex items-center gap-2">
                      <Meter
                        value={row.device.storageUsed}
                        tone={row.device.storageUsed > 85 ? "warn" : "info"}
                        className="w-12"
                      />
                      <span className="t-mono-sm text-[var(--text-3)]">{row.device.storageUsed}%</span>
                    </span>
                  ),
                },
                {
                  key: "uptime",
                  header: "Connectivity",
                  variant: "num",
                  hideBelow: "2xl",
                  sortBy: (row) => row.device.connectivityUptime,
                  render: (row) => `${row.device.connectivityUptime.toFixed(2)}%`,
                },
                {
                  key: "state",
                  header: "Sync state",
                  render: () => (
                    <StatusBadge tone="idle" dot>
                      Queuing locally
                    </StatusBadge>
                  ),
                },
              ]}
            />
          </Panel>
        </Section>
      </PageBody>

      <EvidenceDrawer />
    </Page>
  );
}

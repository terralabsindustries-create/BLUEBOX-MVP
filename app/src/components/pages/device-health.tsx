"use client";

import { useMemo, useState } from "react";
import { HardDrive, ShieldQuestion } from "lucide-react";
import { Page, PageBody, PageHeader, HeaderStat } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHead, Field, FieldGrid } from "@/components/ui/panel";
import { DataTable, IdentityCell } from "@/components/ui/data-table";
import { Readout } from "@/components/ui/metric";
import { Button, Segmented } from "@/components/ui/button";
import { DeviceStateIndicator, Meter, StatusBadge } from "@/components/ui/status";
import { EmptyState } from "@/components/ui/states";
import { DetailPane } from "@/components/ui/drawer";
import { copyFor } from "@/components/layout/nav-config";
import { useSimulationStore } from "@/store/simulation-store";
import { useJurisdiction } from "@/lib/use-jurisdiction";
import { toneOf } from "@/lib/status";
import { elapsedSince } from "@/lib/utils";
import type { DeviceHealth } from "@/lib/types";

const FILTERS = ["All", "Healthy", "Warning", "Offline", "Tamper", "Service Required"] as const;
type Filter = (typeof FILTERS)[number];

/** Storage arrives as a `"NN%"` string; the meter needs the number behind it. */
function storagePercent(value: string) {
  const parsed = Number.parseInt(value.replace("%", ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * DEVICE FLEET
 *
 * Infrastructure monitoring, not a device gallery. The screen answers four
 * questions in order: how ready is the fleet overall, which devices are not
 * healthy, why, and which need someone physically sent to them.
 *
 * A device is rendered as a row, never as a card — an operator compares across
 * devices far more often than they read one, and cards make comparison hard.
 */
export function DeviceHealthPage() {
  const copy = copyFor("/device-health");
  const j = useJurisdiction();
  const now = useSimulationStore((state) => state.now);
  const rows = useSimulationStore((state) => state.deviceHealth);
  const filter = useSimulationStore((state) => state.deviceHealthFilter) as Filter;
  const setFilter = useSimulationStore((state) => state.setDeviceHealthFilter);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const result = { All: rows.length } as Record<Filter, number>;
    for (const key of FILTERS) if (key !== "All") result[key] = 0;
    for (const row of rows) result[row.health as Filter] = (result[row.health as Filter] ?? 0) + 1;
    return result;
  }, [rows]);

  const filtered = filter === "All" ? rows : rows.filter((row) => row.health === filter);
  const readiness = rows.length > 0 ? ((counts.Healthy ?? 0) / rows.length) * 100 : 0;
  const selected = rows.find((row) => row.deviceId === selectedId) ?? null;

  return (
    <Page>
      <PageHeader
        group={copy.group}
        title={copy.title}
        description={copy.description}
        status={
          <>
            <HeaderStat label="Devices" value={j.number(rows.length)} />
            <HeaderStat label="Readiness" value={`${readiness.toFixed(1)}%`} tone={readiness > 90 ? "ok" : "warn"} />
            <HeaderStat
              label="Intervention"
              value={j.number((counts.Tamper ?? 0) + (counts["Service Required"] ?? 0))}
              tone={(counts.Tamper ?? 0) > 0 ? "crit" : "ok"}
            />
          </>
        }
      />

      <PageBody className="flex flex-col gap-3 overflow-hidden p-3.5">
        {/* Fleet readiness — one figure, then the breakdown that explains it. */}
        <Panel className="shrink-0">
          <PanelBody pad="md">
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
              <div className="min-w-[180px]">
                <p className="t-label">Fleet operational readiness</p>
                <p className="t-metric-lg mt-1.5">{readiness.toFixed(1)}%</p>
                <Meter
                  value={readiness}
                  tone={readiness > 95 ? "ok" : readiness > 85 ? "warn" : "crit"}
                  label="Fleet operational readiness"
                  className="mt-2 max-w-[240px]"
                />
                <p className="t-meta mt-1.5">
                  {j.number(counts.Healthy ?? 0)} of {j.number(rows.length)} devices reporting all subsystems nominal
                </p>
              </div>

              <div className="flex flex-wrap items-start gap-x-7 gap-y-3">
                <Readout label="Healthy" value={j.number(counts.Healthy ?? 0)} tone="ok" />
                <Readout label="Warning" value={j.number(counts.Warning ?? 0)} tone="warn" />
                <Readout label="Offline" value={j.number(counts.Offline ?? 0)} tone="idle" />
                <Readout label="Tamper" value={j.number(counts.Tamper ?? 0)} tone="tamper" />
                <Readout label="Service required" value={j.number(counts["Service Required"] ?? 0)} tone="warn" />
              </div>
            </div>
          </PanelBody>
        </Panel>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Segmented<Filter>
            ariaLabel="Filter by device health"
            value={filter}
            onChange={setFilter}
            options={FILTERS.map((item) => ({ value: item, label: item, count: counts[item] ?? 0 }))}
          />
          <span className="t-meta ml-auto">{j.number(filtered.length)} shown</span>
        </div>

        <div className="grid min-h-0 flex-1 gap-3 2xl:grid-cols-[minmax(0,1fr)_380px]">
          <Panel className="min-h-0">
            <PanelHead title="Device fleet" icon={<HardDrive className="h-3.5 w-3.5" />} />
            <DataTable
              caption="Device fleet diagnostics"
              rows={filtered}
              rowKey={(row) => row.deviceId}
              onRowClick={(row) => setSelectedId(row.deviceId)}
              selectedKey={selectedId}
              severityOf={(row) =>
                row.health === "Tamper" ? "tamper" : row.health === "Warning" ? "warn" : undefined
              }
              className="min-h-0 flex-1"
              emptyState={
                <EmptyState
                  icon={<ShieldQuestion className="h-4 w-4" />}
                  title={`No devices in “${filter}”`}
                  description="Nothing in the registry currently reports this state."
                  action={
                    <Button size="sm" variant="secondary" onClick={() => setFilter("All")}>
                      Show all devices
                    </Button>
                  }
                />
              }
              columns={[
                {
                  key: "device",
                  header: "Device",
                  sortBy: (row) => row.deviceId,
                  render: (row) => <IdentityCell title={row.deviceId} subtitle={row.vehicle} mono />,
                },
                {
                  key: "online",
                  header: "Link",
                  hideBelow: "sm",
                  render: (row) => <StatusBadge tone={toneOf(row.online)}>{row.online}</StatusBadge>,
                },
                {
                  key: "gnss",
                  header: "GNSS",
                  hideBelow: "md",
                  render: (row) => (
                    <span className={`t-mono ${toneOf(row.gnss) === "ok" ? "text-[var(--ok-text)]" : "text-[var(--warn-text)]"}`}>
                      {row.gnss}
                    </span>
                  ),
                },
                {
                  key: "signal",
                  header: "Signal",
                  hideBelow: "xl",
                  render: (row) => <span className="t-mono text-[var(--text-3)]">{row.signal}</span>,
                },
                {
                  key: "storage",
                  header: "Storage",
                  hideBelow: "lg",
                  sortBy: (row) => storagePercent(row.storage),
                  render: (row) => (
                    <span className="flex items-center gap-2">
                      <Meter
                        value={storagePercent(row.storage)}
                        tone={storagePercent(row.storage) > 85 ? "warn" : "info"}
                        className="w-12"
                      />
                      <span className="t-mono-sm text-[var(--text-3)]">{row.storage}</span>
                    </span>
                  ),
                },
                {
                  key: "firmware",
                  header: "Firmware",
                  variant: "mono",
                  hideBelow: "2xl",
                  sortBy: (row) => row.firmware,
                  render: (row) => row.firmware,
                },
                {
                  key: "uptime",
                  header: "Uptime",
                  variant: "num",
                  hideBelow: "2xl",
                  render: (row) => row.uptime,
                },
                {
                  key: "heartbeat",
                  header: "Last heartbeat",
                  hideBelow: "lg",
                  sortBy: (row) => row.lastHeartbeat,
                  render: (row) => (
                    <span className="t-mono-sm text-[var(--text-3)]">{elapsedSince(row.lastHeartbeat, now)}</span>
                  ),
                },
                {
                  key: "health",
                  header: "Health",
                  sortBy: (row) => row.health,
                  render: (row) => (
                    <StatusBadge tone={toneOf(row.health)} solid={row.health === "Tamper"}>
                      {row.health}
                    </StatusBadge>
                  ),
                },
              ]}
            />
          </Panel>

          {selected ? (
            <DetailPane
              eyebrow="Device diagnostics"
              title={selected.deviceId}
              onClose={() => setSelectedId(null)}
              tone={selected.health === "Tamper" ? "crit" : selected.health === "Warning" ? "warn" : undefined}
              className="hidden min-h-0 2xl:flex"
            >
              <DeviceDiagnostics device={selected} now={now} />
            </DetailPane>
          ) : (
            <Panel className="hidden min-h-0 2xl:flex">
              <PanelHead title="Diagnostics" />
              <EmptyState
                icon={<HardDrive className="h-4 w-4" />}
                title="No device selected"
                description="Select a device to inspect its subsystem readings, firmware and heartbeat history."
              />
            </Panel>
          )}
        </div>
      </PageBody>
    </Page>
  );
}

function DeviceDiagnostics({ device, now }: Readonly<{ device: DeviceHealth; now: string }>) {
  const j = useJurisdiction();

  return (
    <div>
      <section className="border-b border-[var(--line)] px-4 py-3.5">
        <p className="t-label mb-2.5">Subsystems</p>
        <div className="grid gap-2">
          <DeviceStateIndicator label="Link" value={device.online} />
          <DeviceStateIndicator label="GNSS" value={device.gnss} />
          <DeviceStateIndicator label="Signal" value={device.signal} />
          <DeviceStateIndicator label="Power" value={device.vehiclePower} />
          <DeviceStateIndicator label="Tamper" value={device.tamper} />
        </div>
      </section>

      <section className="border-b border-[var(--line)] px-4 py-3.5">
        <p className="t-label mb-2.5">Capacity</p>
        <div className="flex items-baseline justify-between gap-3">
          <span className="t-meta">Local evidence storage</span>
          <span className="t-mono font-semibold text-[var(--text)]">{device.storage}</span>
        </div>
        <Meter
          value={storagePercent(device.storage)}
          tone={storagePercent(device.storage) > 85 ? "warn" : "info"}
          label="Storage used"
          className="mt-1.5"
        />
        <div className="mt-3 flex items-baseline justify-between gap-3">
          <span className="t-meta">Backup power</span>
          <span className="t-mono font-semibold text-[var(--text)]">{device.backupPower}</span>
        </div>
        <Meter
          value={storagePercent(device.backupPower)}
          tone={storagePercent(device.backupPower) < 30 ? "crit" : "ok"}
          label="Backup power remaining"
          className="mt-1.5"
        />
      </section>

      <section className="px-4 py-3.5">
        <p className="t-label mb-2.5">Registry</p>
        <FieldGrid columns={2}>
          <Field label="Device" value={device.deviceId} mono />
          <Field label="Vehicle" value={device.vehicle} mono />
          <Field label="Firmware" value={device.firmware} mono />
          <Field label="Rule version" value={device.ruleVersion} mono />
          <Field label="Uptime" value={device.uptime} mono />
          <Field label="Last heartbeat" value={elapsedSince(device.lastHeartbeat, now)} mono />
          <Field
            label="Recorded at"
            value={j.dateTime(device.lastHeartbeat)}
            mono
            className="col-span-2"
          />
        </FieldGrid>
      </section>
    </div>
  );
}

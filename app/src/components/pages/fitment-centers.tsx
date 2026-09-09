"use client";

import { useMemo, useState } from "react";
import { Wrench } from "lucide-react";
import { Page, PageBody, PageHeader, HeaderStat } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHead, Field, FieldGrid, Section } from "@/components/ui/panel";
import { DataTable, IdentityCell } from "@/components/ui/data-table";
import { MetricCell, MetricStrip4 } from "@/components/ui/metric";
import { Meter, StatusBadge } from "@/components/ui/status";
import { EmptyState } from "@/components/ui/states";
import { DetailPane } from "@/components/ui/drawer";
import { Timeline, type TimelineStep } from "@/components/ui/timeline";
import { copyFor } from "@/components/layout/nav-config";
import { useSimulationStore } from "@/store/simulation-store";
import { useJurisdiction } from "@/lib/use-jurisdiction";
import { toneOf } from "@/lib/status";
import type { FitmentCenter } from "@/lib/types";

/**
 * The nine gates every device passes before it can report as active. This is
 * the standard commissioning process, not a live per-device state — a device
 * that has not cleared all nine simply does not appear in the fleet.
 */
const ACTIVATION_GATES = [
  "Owner verification",
  "QR scan",
  "Vehicle mapping",
  "Install device",
  "Seal device",
  "GNSS test",
  "Network test",
  "First heartbeat",
  "Active",
] as const;

/**
 * DEPLOYMENT NETWORK
 *
 * Installation quality is an integrity question, not an operations one: a
 * device fitted badly produces evidence nobody should trust. So the table
 * leads with activation rate and failed installations rather than with
 * throughput.
 */
export function FitmentCentersPage() {
  const copy = copyFor("/fitment-centers");
  const j = useJurisdiction();
  const centers = useSimulationStore((state) => state.fitmentCenters);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const totals = useMemo(
    () =>
      centers.reduce(
        (acc, center) => ({
          installed: acc.installed + center.installedDevices,
          active: acc.active + center.activeDevices,
          failed: acc.failed + center.failedInstallations,
          service: acc.service + center.serviceRequests,
        }),
        { installed: 0, active: 0, failed: 0, service: 0 },
      ),
    [centers],
  );

  const activationRate = totals.installed > 0 ? (totals.active / totals.installed) * 100 : 0;
  const selected = centers.find((center) => center.id === selectedId) ?? null;

  const gates: TimelineStep[] = ACTIVATION_GATES.map((label) => ({ label, state: "done" }));

  return (
    <Page>
      <PageHeader
        group={copy.group}
        title={copy.title}
        description={copy.description}
        status={
          <>
            <HeaderStat label="Centres" value={j.number(centers.length)} />
            <HeaderStat
              label="Activation rate"
              value={`${activationRate.toFixed(1)}%`}
              tone={activationRate > 95 ? "ok" : "warn"}
            />
            <HeaderStat label="Failed" value={j.number(totals.failed)} tone={totals.failed > 0 ? "warn" : "ok"} />
          </>
        }
      />

      <PageBody>
        <MetricStrip4>
          <MetricCell label="Devices installed" value={j.number(totals.installed)} caption="Across every centre" />
          <MetricCell
            label="Activated"
            value={j.number(totals.active)}
            caption={`${activationRate.toFixed(1)}% of installations`}
            tone="ok"
          />
          <MetricCell
            label="Failed installations"
            value={j.number(totals.failed)}
            caption="Require re-fitment before use"
            tone={totals.failed > 0 ? "crit" : "ok"}
          />
          <MetricCell
            label="Service requests"
            value={j.number(totals.service)}
            caption="Open across the network"
            tone={totals.service > 0 ? "warn" : "ok"}
          />
        </MetricStrip4>

        <div className="grid gap-3 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <Section title="Centre performance" description="Installation throughput and activation quality">
            <Panel>
              <PanelHead title="Fitment centres" icon={<Wrench className="h-3.5 w-3.5" />} />
              <DataTable
                caption="Fitment centre performance"
                rows={centers}
                rowKey={(row) => row.id}
                onRowClick={(row) => setSelectedId(row.id)}
                selectedKey={selectedId}
                density="relaxed"
                severityOf={(row) =>
                  row.status === "Escalated" ? "crit" : row.status === "Watch" ? "warn" : undefined
                }
                emptyState={
                  <EmptyState
                    icon={<Wrench className="h-4 w-4" />}
                    title="No fitment centres registered"
                    description="Centres appear here once they are commissioned in the deployment."
                  />
                }
                columns={[
                  {
                    key: "centre",
                    header: "Centre",
                    sortBy: (row) => row.name,
                    render: (row) => <IdentityCell title={row.name} subtitle={row.id} />,
                  },
                  {
                    key: "district",
                    header: "District",
                    hideBelow: "sm",
                    sortBy: (row) => row.district,
                    render: (row) => <span className="t-meta">{row.district}</span>,
                  },
                  {
                    key: "installed",
                    header: "Installed",
                    variant: "num",
                    sortBy: (row) => row.installedDevices,
                    render: (row) => j.number(row.installedDevices),
                  },
                  {
                    key: "active",
                    header: "Active",
                    variant: "num",
                    hideBelow: "md",
                    sortBy: (row) => row.activeDevices,
                    render: (row) => j.number(row.activeDevices),
                  },
                  {
                    key: "rate",
                    header: "Activation",
                    hideBelow: "lg",
                    sortBy: (row) => row.activeDevices / Math.max(1, row.installedDevices),
                    render: (row) => {
                      const rate = (row.activeDevices / Math.max(1, row.installedDevices)) * 100;
                      return (
                        <span className="flex items-center gap-2">
                          <Meter value={rate} tone={rate > 95 ? "ok" : "warn"} className="w-12" />
                          <span className="t-mono-sm text-[var(--text-3)]">{rate.toFixed(1)}%</span>
                        </span>
                      );
                    },
                  },
                  {
                    key: "failed",
                    header: "Failed",
                    variant: "num",
                    hideBelow: "xl",
                    sortBy: (row) => row.failedInstallations,
                    render: (row) => (
                      <span className={row.failedInstallations > 0 ? "text-[var(--crit-text)]" : undefined}>
                        {j.number(row.failedInstallations)}
                      </span>
                    ),
                  },
                  {
                    key: "service",
                    header: "Service",
                    variant: "num",
                    hideBelow: "xl",
                    sortBy: (row) => row.serviceRequests,
                    render: (row) => j.number(row.serviceRequests),
                  },
                  {
                    key: "last",
                    header: "Last activation",
                    hideBelow: "2xl",
                    sortBy: (row) => row.lastActivation,
                    render: (row) => <span className="t-mono-sm text-[var(--text-3)]">{j.date(row.lastActivation)}</span>,
                  },
                  {
                    key: "status",
                    header: "Status",
                    sortBy: (row) => row.status,
                    render: (row) => <StatusBadge tone={toneOf(row.status)}>{row.status}</StatusBadge>,
                  },
                ]}
              />
            </Panel>
          </Section>

          {selected ? (
            <DetailPane
              eyebrow="Fitment centre"
              title={selected.name}
              onClose={() => setSelectedId(null)}
              tone={selected.status === "Escalated" ? "crit" : selected.status === "Watch" ? "warn" : undefined}
              className="min-h-0"
            >
              <CentreBody centre={selected} />
            </DetailPane>
          ) : (
            <Panel className="hidden 2xl:flex">
              <PanelHead title="Centre record" />
              <EmptyState
                icon={<Wrench className="h-4 w-4" />}
                title="No centre selected"
                description="Select a centre to see its installation and activation figures."
              />
            </Panel>
          )}
        </div>

        <Section
          title="Activation workflow"
          description="The standard commissioning process — every device clears all nine gates before it reports as active"
        >
          <Panel>
            <PanelBody pad="md">
              <Timeline steps={gates} orientation="horizontal" />
              <p className="t-meta mt-3 border-t border-[var(--line-soft)] pt-2.5 leading-snug">
                A device that has not cleared every gate does not appear in the fleet and cannot produce enforcement
                input. Sealing and the GNSS test are what make a later tamper event meaningful — an unsealed device has
                no baseline to have been tampered with.
              </p>
            </PanelBody>
          </Panel>
        </Section>
      </PageBody>
    </Page>
  );
}

function CentreBody({ centre }: Readonly<{ centre: FitmentCenter }>) {
  const j = useJurisdiction();
  const rate = (centre.activeDevices / Math.max(1, centre.installedDevices)) * 100;

  return (
    <div>
      <section className="border-b border-[var(--line)] px-4 py-3.5">
        <p className="t-label">Activation rate</p>
        <p className="t-metric-lg mt-1.5">{rate.toFixed(1)}%</p>
        <Meter value={rate} tone={rate > 95 ? "ok" : "warn"} label="Activation rate" className="mt-2" />
        <p className="t-meta mt-1.5">
          {j.number(centre.activeDevices)} of {j.number(centre.installedDevices)} installations reporting
        </p>
      </section>

      <section className="px-4 py-3.5">
        <p className="t-label mb-2.5">Centre</p>
        <FieldGrid columns={2}>
          <Field label="Centre ID" value={centre.id} mono />
          <Field label="District" value={centre.district} />
          <Field label="Installed" value={j.number(centre.installedDevices)} mono />
          <Field label="Active" value={j.number(centre.activeDevices)} mono tone="ok" />
          <Field
            label="Failed"
            value={j.number(centre.failedInstallations)}
            mono
            tone={centre.failedInstallations > 0 ? "crit" : undefined}
          />
          <Field
            label="Service requests"
            value={j.number(centre.serviceRequests)}
            mono
            tone={centre.serviceRequests > 0 ? "warn" : undefined}
          />
          <Field label="Last activation" value={j.dateTime(centre.lastActivation)} mono className="col-span-2" />
          <Field label="Status" value={centre.status} tone={toneOf(centre.status)} className="col-span-2" />
        </FieldGrid>
      </section>
    </div>
  );
}

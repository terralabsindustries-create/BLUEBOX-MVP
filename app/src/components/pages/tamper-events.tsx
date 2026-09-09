"use client";

import { useMemo, useState } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Page, PageBody, PageHeader, HeaderStat } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHead, Field, FieldGrid, Section } from "@/components/ui/panel";
import { DataTable, IdentityCell } from "@/components/ui/data-table";
import { Readout } from "@/components/ui/metric";
import { Button, Segmented } from "@/components/ui/button";
import { SeverityBadge, StatusBadge, StatusDot } from "@/components/ui/status";
import { ConditionState, EmptyState } from "@/components/ui/states";
import { DetailPane } from "@/components/ui/drawer";
import { Timeline, type TimelineStep } from "@/components/ui/timeline";
import { copyFor } from "@/components/layout/nav-config";
import { useSimulationStore } from "@/store/simulation-store";
import { useJurisdiction } from "@/lib/use-jurisdiction";
import { type Severity, severityRank, toneOf } from "@/lib/status";
import type { TamperEvent } from "@/lib/types";

type StatusFilter = "all" | "Open" | "Investigating" | "Resolved";
type SeverityFilter = "all" | Severity;

/**
 * SECURITY INCIDENTS
 *
 * Tamper is not a speed problem, and this screen exists partly to keep the two
 * from blurring: every tone here is the magenta tamper scale, never the red
 * used for violations. An officer glancing at two screens must be able to tell
 * "someone opened a device" from "someone drove too fast" without reading.
 *
 * Repeat activity gets its own section, because one tamper event on a device is
 * an incident and three is a pattern — and the pattern is the finding.
 */
export function TamperEventsPage() {
  const copy = copyFor("/tamper-events");
  const j = useJurisdiction();
  const events = useSimulationStore((state) => state.tamperEvents);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      all: events.length,
      Open: events.filter((event) => event.status === "Open").length,
      Investigating: events.filter((event) => event.status === "Investigating").length,
      Resolved: events.filter((event) => event.status === "Resolved").length,
      Critical: events.filter((event) => event.severity === "Critical").length,
      High: events.filter((event) => event.severity === "High").length,
      Medium: events.filter((event) => event.severity === "Medium").length,
      Low: events.filter((event) => event.severity === "Low").length,
    }),
    [events],
  );

  const inspections = events.filter(
    (event) => event.inspectionRequired === "Yes" && event.status !== "Resolved",
  ).length;

  const filtered = useMemo(
    () =>
      events.filter(
        (event) =>
          (statusFilter === "all" || event.status === statusFilter) &&
          (severityFilter === "all" || event.severity === severityFilter),
      ),
    [events, statusFilter, severityFilter],
  );

  /** Devices with more than one incident — the pattern, not the instance. */
  const repeats = useMemo(() => {
    const grouped = new Map<string, TamperEvent[]>();
    for (const event of events) {
      grouped.set(event.deviceId, [...(grouped.get(event.deviceId) ?? []), event]);
    }
    return [...grouped.entries()]
      .filter(([, list]) => list.length > 1)
      .map(([deviceId, list]) => ({
        deviceId,
        vehicle: list[0].vehicle,
        count: list.length,
        worst: list.reduce<Severity>(
          (worst, item) => (severityRank[item.severity] > severityRank[worst] ? item.severity : worst),
          "Low",
        ),
        open: list.filter((item) => item.status !== "Resolved").length,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [events]);

  const selected = events.find((event) => event.id === selectedId) ?? null;

  return (
    <Page>
      <PageHeader
        group={copy.group}
        title={copy.title}
        description={copy.description}
        status={
          <>
            <HeaderStat label="Open" value={j.number(counts.Open)} tone={counts.Open > 0 ? "crit" : "ok"} />
            <HeaderStat label="Critical" value={j.number(counts.Critical)} tone={counts.Critical > 0 ? "crit" : "ok"} />
            <HeaderStat label="Inspections" value={j.number(inspections)} tone={inspections > 0 ? "warn" : "ok"} />
          </>
        }
      />

      <PageBody className="flex flex-col gap-3 overflow-hidden p-3.5">
        {inspections > 0 ? (
          <ConditionState
            tone="tamper"
            title={`${j.number(inspections)} device${inspections === 1 ? "" : "s"} require physical inspection`}
            description="Integrity events cannot be cleared remotely. Each of these needs a technician dispatched to the vehicle before the device can be trusted again."
            className="shrink-0"
          />
        ) : null}

        <Panel className="shrink-0">
          <PanelBody pad="md">
            <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
              <Readout label="Total events" value={j.number(counts.all)} />
              <Readout label="Open" value={j.number(counts.Open)} tone={counts.Open > 0 ? "tamper" : "ok"} />
              <Readout label="Investigating" value={j.number(counts.Investigating)} tone="warn" />
              <Readout label="Resolved" value={j.number(counts.Resolved)} tone="ok" />
              <Readout label="Critical" value={j.number(counts.Critical)} tone={counts.Critical > 0 ? "tamper" : "ok"} />
            </div>
          </PanelBody>
        </Panel>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Segmented<StatusFilter>
            ariaLabel="Filter by incident status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "all", label: "All", count: counts.all },
              { value: "Open", label: "Open", count: counts.Open },
              { value: "Investigating", label: "Investigating", count: counts.Investigating },
              { value: "Resolved", label: "Resolved", count: counts.Resolved },
            ]}
          />
          <Segmented<SeverityFilter>
            ariaLabel="Filter by severity"
            value={severityFilter}
            onChange={setSeverityFilter}
            options={[
              { value: "all", label: "Any severity" },
              { value: "Critical", label: "Critical", count: counts.Critical },
              { value: "High", label: "High", count: counts.High },
              { value: "Medium", label: "Medium", count: counts.Medium },
            ]}
          />
          <span className="t-meta ml-auto">{j.number(filtered.length)} shown</span>
        </div>

        <div className="grid min-h-0 flex-1 gap-3 2xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex min-h-0 flex-col gap-3">
            <Panel className="min-h-0 flex-1">
              <PanelHead title="Incident log" icon={<ShieldAlert className="h-3.5 w-3.5" />} />
              <DataTable
                caption="Tamper and integrity incident log"
                rows={filtered}
                rowKey={(row) => row.id}
                onRowClick={(row) => setSelectedId(row.id)}
                selectedKey={selectedId}
                density="relaxed"
                severityOf={(row) =>
                  row.severity === "Critical" ? "tamper" : row.severity === "High" ? "crit" : "warn"
                }
                className="min-h-0 flex-1"
                defaultSort={{ key: "time", direction: "desc" }}
                emptyState={
                  <EmptyState
                    tone="ok"
                    icon={<ShieldCheck className="h-4 w-4" />}
                    title="No tamper events"
                    description="No device in the fleet has reported a physical or firmware integrity event in this view."
                    action={
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setStatusFilter("all");
                          setSeverityFilter("all");
                        }}
                      >
                        Clear filters
                      </Button>
                    }
                  />
                }
                columns={[
                  {
                    key: "time",
                    header: "Detected",
                    hideBelow: "sm",
                    sortBy: (row) => row.timestamp,
                    render: (row) => (
                      <span className="t-mono-sm text-[var(--text-3)]">{j.dateTime(row.timestamp)}</span>
                    ),
                  },
                  {
                    key: "device",
                    header: "Device",
                    sortBy: (row) => row.deviceId,
                    render: (row) => <IdentityCell title={row.deviceId} subtitle={row.vehicle} mono />,
                  },
                  {
                    key: "event",
                    header: "Event",
                    variant: "mono",
                    sortBy: (row) => row.eventType,
                    render: (row) => <span className="text-[var(--text)]">{row.eventType}</span>,
                  },
                  {
                    key: "location",
                    header: "Location",
                    hideBelow: "xl",
                    render: (row) => <span className="t-meta">{row.location}</span>,
                  },
                  {
                    key: "severity",
                    header: "Severity",
                    sortBy: (row) => severityRank[row.severity],
                    render: (row) => <SeverityBadge severity={row.severity} />,
                  },
                  {
                    key: "status",
                    header: "Status",
                    hideBelow: "md",
                    sortBy: (row) => row.status,
                    render: (row) => <StatusBadge tone={toneOf(row.status)}>{row.status}</StatusBadge>,
                  },
                  {
                    key: "inspection",
                    header: "Inspection",
                    hideBelow: "2xl",
                    render: (row) => (
                      <span
                        className={
                          row.inspectionRequired === "Yes" ? "t-mono text-[var(--tamper-text)]" : "t-mono text-[var(--text-4)]"
                        }
                      >
                        {row.inspectionRequired}
                      </span>
                    ),
                  },
                ]}
              />
            </Panel>

            {repeats.length > 0 ? (
              <Section title="Repeat activity" description="Devices with more than one recorded incident" className="shrink-0">
                <Panel>
                  <ul className="divide-y divide-[var(--line-soft)]">
                    {repeats.map((entry) => (
                      <li key={entry.deviceId} className="flex items-center gap-3 px-3.5 py-2">
                        <StatusDot tone={entry.open > 0 ? "tamper" : "ok"} />
                        <span className="t-mono w-[150px] shrink-0 truncate text-[var(--text)]">{entry.deviceId}</span>
                        <span className="t-meta min-w-0 flex-1 truncate">{entry.vehicle}</span>
                        <SeverityBadge severity={entry.worst} />
                        <span className="t-num w-16 shrink-0 text-right text-[12px] font-semibold text-[var(--text)]">
                          {j.number(entry.count)} events
                        </span>
                        <span className="t-mono-sm w-16 shrink-0 text-right text-[var(--text-4)]">
                          {j.number(entry.open)} open
                        </span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              </Section>
            ) : null}
          </div>

          {selected ? (
            <DetailPane
              eyebrow="Security incident"
              title={selected.eventType}
              onClose={() => setSelectedId(null)}
              tone={selected.severity === "Critical" ? "crit" : "warn"}
              className="hidden min-h-0 2xl:flex"
            >
              <IncidentBody event={selected} />
            </DetailPane>
          ) : (
            <Panel className="hidden min-h-0 2xl:flex">
              <PanelHead title="Incident record" />
              <EmptyState
                icon={<ShieldAlert className="h-4 w-4" />}
                title="No incident selected"
                description="Select an event to see its record and triage state."
              />
            </Panel>
          )}
        </div>
      </PageBody>
    </Page>
  );
}

function IncidentBody({ event }: Readonly<{ event: TamperEvent }>) {
  const j = useJurisdiction();

  /**
   * Lifecycle. Only the detection instant is a recorded timestamp, so only that
   * step carries one — the later stages show their state without inventing a
   * time the system never captured.
   */
  const steps: TimelineStep[] = [
    { label: "Detected", detail: "Reported by the device over the event channel", timestamp: j.time(event.timestamp), state: "done" },
    { label: "Received", detail: "Recorded in the incident log", state: "done" },
    {
      label: "Acknowledged",
      detail: event.status === "Open" ? "Awaiting operator triage" : "Triaged by an operator",
      state: event.status === "Open" ? "active" : "done",
    },
    {
      label: "Investigating",
      detail: event.inspectionRequired === "Yes" ? "Physical inspection required" : "Remote assessment",
      state: event.status === "Investigating" ? "active" : event.status === "Resolved" ? "done" : "pending",
    },
    {
      label: "Resolved",
      detail: event.status === "Resolved" ? "Device integrity restored" : "Not yet resolved",
      state: event.status === "Resolved" ? "done" : "pending",
    },
  ];

  return (
    <div>
      <section className="border-b border-[var(--line)] px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="t-label">Severity</p>
            <p className="mt-1.5">
              <SeverityBadge severity={event.severity} />
            </p>
          </div>
          <div className="text-right">
            <p className="t-label">Status</p>
            <p className="mt-1.5">
              <StatusBadge tone={toneOf(event.status)}>{event.status}</StatusBadge>
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--line)] px-4 py-3.5">
        <p className="t-label mb-2.5">Incident</p>
        <FieldGrid columns={2}>
          <Field label="Event ID" value={event.id} mono />
          <Field label="Event type" value={event.eventType} mono tone="tamper" />
          <Field label="Device" value={event.deviceId} mono />
          <Field label="Vehicle" value={event.vehicle} mono />
          <Field label="Detected" value={j.dateTime(event.timestamp)} mono />
          <Field
            label="Inspection"
            value={event.inspectionRequired}
            tone={event.inspectionRequired === "Yes" ? "tamper" : undefined}
          />
          <Field label="Location" value={event.location} className="col-span-2" />
        </FieldGrid>
      </section>

      <section className="px-4 py-3.5">
        <p className="t-label mb-3">Triage</p>
        <Timeline steps={steps} />
      </section>
    </div>
  );
}

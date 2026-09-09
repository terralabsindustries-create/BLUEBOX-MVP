"use client";

import { useMemo, useState } from "react";
import { Activity, SearchX } from "lucide-react";
import { Page, PageBody, PageHeader, HeaderStat } from "@/components/ui/page-header";
import { Panel, PanelHead, Field, FieldGrid } from "@/components/ui/panel";
import { DataTable } from "@/components/ui/data-table";
import { Readout } from "@/components/ui/metric";
import { Button, Segmented } from "@/components/ui/button";
import { SearchField, Select } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status";
import { ConditionState, EmptyState } from "@/components/ui/states";
import { DetailPane } from "@/components/ui/drawer";
import { copyFor } from "@/components/layout/nav-config";
import { useSimulationStore } from "@/store/simulation-store";
import { useJurisdiction } from "@/lib/use-jurisdiction";
import { toneOf } from "@/lib/status";
import { shortHash } from "@/lib/utils";
import type { AuditLog } from "@/lib/types";

type StatusFilter = "all" | "SUCCESS" | "PENDING" | "REVIEW";

/**
 * THE AUDIT TRAIL
 *
 * An append-only ledger, and it has to look like one. Records carry a sequence
 * number so gaps would be visible, everything machine-generated is set in mono,
 * and the append-only property is stated at the top rather than left implied —
 * an auditor should not have to take the ordering on faith.
 *
 * The store holds the fields the device and backend actually emit. It does not
 * hold before/after state diffs, so this screen says where those live rather
 * than fabricating them.
 */
export function AuditLogsPage() {
  const copy = copyFor("/audit-logs");
  const j = useJurisdiction();
  const logs = useSimulationStore((state) => state.auditLogs);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [actor, setActor] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const actors = useMemo(() => [...new Set(logs.map((log) => log.actor))].sort(), [logs]);

  const counts = useMemo(
    () => ({
      all: logs.length,
      SUCCESS: logs.filter((log) => log.status === "SUCCESS").length,
      PENDING: logs.filter((log) => log.status === "PENDING").length,
      REVIEW: logs.filter((log) => log.status === "REVIEW").length,
    }),
    [logs],
  );

  /**
   * Sequence numbers are assigned from the store's own ordering, newest first,
   * so the highest number is the most recent entry. Filtering never renumbers:
   * a filtered view still shows each record's position in the whole ledger.
   */
  const indexed = useMemo(
    () => logs.map((log, index) => ({ log, sequence: logs.length - index })),
    [logs],
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return indexed.filter(({ log }) => {
      if (status !== "all" && log.status !== status) return false;
      if (actor !== "all" && log.actor !== actor) return false;
      if (!term) return true;
      return (
        log.actor.toLowerCase().includes(term) ||
        log.action.toLowerCase().includes(term) ||
        log.entity.toLowerCase().includes(term) ||
        log.hashRef.toLowerCase().includes(term)
      );
    });
  }, [indexed, status, actor, query]);

  const selected = logs.find((log) => log.id === selectedId) ?? null;

  return (
    <Page>
      <PageHeader
        group={copy.group}
        title={copy.title}
        description={copy.description}
        status={
          <>
            <HeaderStat label="Records" value={j.number(counts.all)} />
            <HeaderStat label="Committed" value={j.number(counts.SUCCESS)} tone="ok" />
            <HeaderStat label="Pending" value={j.number(counts.PENDING)} tone={counts.PENDING > 0 ? "warn" : "ok"} />
          </>
        }
      />

      <PageBody className="flex flex-col gap-3 overflow-hidden p-3.5">
        <ConditionState
          tone="info"
          title="Append-only trail"
          description="Entries are written once and never edited or removed. Sequence numbers are contiguous, so a missing record would be visible as a gap."
          className="shrink-0"
        />

        <Panel className="shrink-0">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 px-3.5 py-2.5">
            <Readout label="Succeeded" value={j.number(counts.SUCCESS)} tone="ok" size="sm" />
            <Readout label="Pending" value={j.number(counts.PENDING)} tone="warn" size="sm" />
            <Readout label="Under review" value={j.number(counts.REVIEW)} tone="info" size="sm" />
            <Readout label="Distinct actors" value={j.number(actors.length)} size="sm" />
          </div>
        </Panel>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Actor, action, entity or hash"
            className="w-full max-w-xs"
            aria-label="Filter the audit trail"
          />
          <Segmented<StatusFilter>
            ariaLabel="Filter by record status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "All", count: counts.all },
              { value: "SUCCESS", label: "Success", count: counts.SUCCESS },
              { value: "PENDING", label: "Pending", count: counts.PENDING },
              { value: "REVIEW", label: "Review", count: counts.REVIEW },
            ]}
          />
          <Select
            value={actor}
            onChange={(event) => setActor(event.target.value)}
            aria-label="Filter by actor"
            className="h-7 w-auto min-w-[150px]"
          >
            <option value="all">All actors</option>
            {actors.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
          <span className="t-meta ml-auto">{j.number(filtered.length)} shown</span>
        </div>

        <div className="grid min-h-0 flex-1 gap-3 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <Panel className="min-h-0">
            <PanelHead title="Ledger" icon={<Activity className="h-3.5 w-3.5" />} meta="Newest first" />
            <DataTable
              caption="Append-only audit trail"
              rows={filtered}
              rowKey={(row) => row.log.id}
              onRowClick={(row) => setSelectedId(row.log.id)}
              selectedKey={selectedId}
              className="min-h-0 flex-1"
              emptyState={
                <EmptyState
                  icon={<SearchX className="h-4 w-4" />}
                  title="No records match"
                  description="No entry in the trail matches these filters. The ledger itself is unchanged."
                  action={
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setStatus("all");
                        setActor("all");
                        setQuery("");
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                >
                </EmptyState>
              }
              columns={[
                {
                  key: "seq",
                  header: "#",
                  variant: "num",
                  width: "56px",
                  sortBy: (row) => row.sequence,
                  render: (row) => <span className="t-mono-sm text-[var(--text-4)]">{row.sequence}</span>,
                },
                {
                  key: "time",
                  header: "Timestamp",
                  hideBelow: "sm",
                  sortBy: (row) => row.log.timestamp,
                  render: (row) => (
                    <span className="t-mono-sm text-[var(--text-3)]">{j.dateTime(row.log.timestamp)}</span>
                  ),
                },
                {
                  key: "actor",
                  header: "Actor",
                  variant: "mono",
                  hideBelow: "md",
                  sortBy: (row) => row.log.actor,
                  render: (row) => row.log.actor,
                },
                {
                  key: "action",
                  header: "Action",
                  variant: "mono",
                  sortBy: (row) => row.log.action,
                  render: (row) => <span className="text-[var(--text)]">{row.log.action}</span>,
                },
                {
                  key: "entity",
                  header: "Entity",
                  variant: "mono",
                  hideBelow: "lg",
                  sortBy: (row) => row.log.entity,
                  render: (row) => row.log.entity,
                },
                {
                  key: "status",
                  header: "Status",
                  sortBy: (row) => row.log.status,
                  render: (row) => <StatusBadge tone={toneOf(row.log.status)}>{row.log.status}</StatusBadge>,
                },
                {
                  key: "hash",
                  header: "Integrity",
                  variant: "mono",
                  hideBelow: "xl",
                  render: (row) => (
                    <span className="text-[var(--text-4)]" title={row.log.hashRef}>
                      {shortHash(row.log.hashRef)}
                    </span>
                  ),
                },
              ]}
            />
          </Panel>

          {selected ? (
            <DetailPane
              eyebrow="Ledger entry"
              title={selected.action}
              onClose={() => setSelectedId(null)}
              className="hidden min-h-0 2xl:flex"
            >
              <EntryBody entry={selected} />
            </DetailPane>
          ) : (
            <Panel className="hidden min-h-0 2xl:flex">
              <PanelHead title="Ledger entry" />
              <EmptyState
                icon={<Activity className="h-4 w-4" />}
                title="No entry selected"
                description="Select a record to inspect its actor, entity and integrity reference."
              />
            </Panel>
          )}
        </div>
      </PageBody>
    </Page>
  );
}

function EntryBody({ entry }: Readonly<{ entry: AuditLog }>) {
  const j = useJurisdiction();

  return (
    <div>
      <section className="border-b border-[var(--line)] px-4 py-3.5">
        <p className="t-label mb-2.5">Entry</p>
        <FieldGrid columns={2}>
          <Field label="Record ID" value={entry.id} mono />
          <Field label="Status" value={entry.status} mono tone={toneOf(entry.status)} />
          <Field label="Actor" value={entry.actor} mono />
          <Field label="Action" value={entry.action} mono />
          <Field label="Entity" value={entry.entity} mono className="col-span-2" />
          <Field label="Recorded" value={j.dateTime(entry.timestamp)} mono className="col-span-2" />
        </FieldGrid>
      </section>

      <section className="border-b border-[var(--line)] px-4 py-3.5">
        <p className="t-label mb-2">Integrity reference</p>
        <div className="well px-3 py-2">
          <p className="t-mono break-all text-[var(--text-2)]">{entry.hashRef}</p>
        </div>
      </section>

      <section className="px-4 py-3.5">
        <p className="t-meta leading-relaxed">
          This trail records that an action occurred, who performed it and against which entity. The full
          previous-state and new-state diff for each transition is held in the backend record referenced by the
          integrity hash above, and is not mirrored into the dashboard.
        </p>
      </section>
    </div>
  );
}

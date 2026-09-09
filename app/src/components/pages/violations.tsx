"use client";

import { useMemo, useState } from "react";
import { FileSearch, ScrollText } from "lucide-react";
import { Page, PageBody, PageHeader, HeaderStat } from "@/components/ui/page-header";
import { Panel, PanelHead } from "@/components/ui/panel";
import { DataTable, IdentityCell, SpeedCell } from "@/components/ui/data-table";
import { MetricCell, MetricStrip4 } from "@/components/ui/metric";
import { Button, Segmented } from "@/components/ui/button";
import { SearchField } from "@/components/ui/input";
import { StatusBadge, VerificationState } from "@/components/ui/status";
import { EmptyState } from "@/components/ui/states";
import { DetailPane } from "@/components/ui/drawer";
import { EvidenceBody, EvidenceDrawer } from "@/components/violations/evidence-drawer";
import { copyFor } from "@/components/layout/nav-config";
import { useSimulationStore } from "@/store/simulation-store";
import { useJurisdiction } from "@/lib/use-jurisdiction";
import { normalisePlate } from "@/lib/jurisdiction";
import { levelTone } from "@/lib/status";
import type { ViolationEvent } from "@/lib/types";

type Filter = "all" | "verified" | "pending" | "offline";

/**
 * THE EVIDENCE CONSOLE
 *
 * A violation is not a table row — it is a claim that has to survive scrutiny.
 * So the register is a master–detail pair with the record's full argument
 * docked beside it: an officer comparing two events should never have to close
 * one to open the other.
 *
 * The distinction the whole console turns on is *signed on the device* versus
 * *verified by the backend*, and it is carried in its own column rather than
 * folded into a generic status chip.
 */
export function ViolationsPage() {
  const copy = copyFor("/violations");
  const j = useJurisdiction();
  const violations = useSimulationStore((state) => state.violations);
  const selectedViolationId = useSimulationStore((state) => state.selectedViolationId);
  const selectViolation = useSimulationStore((state) => state.selectViolation);

  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(
    () => ({
      all: violations.length,
      verified: violations.filter((item) => item.backendVerification === "PASSED").length,
      pending: violations.filter((item) => item.uploadStatus !== "UPLOADED").length,
      offline: violations.filter((item) => item.networkStatusAtEvent === "OFFLINE_AT_EVENT").length,
    }),
    [violations],
  );

  const filtered = useMemo(() => {
    const plate = normalisePlate(query);
    const term = query.trim().toLowerCase();
    return violations.filter((item) => {
      if (filter === "verified" && item.backendVerification !== "PASSED") return false;
      if (filter === "pending" && item.uploadStatus === "UPLOADED") return false;
      if (filter === "offline" && item.networkStatusAtEvent !== "OFFLINE_AT_EVENT") return false;
      if (!term) return true;
      return (
        item.id.toLowerCase().includes(term) || normalisePlate(item.registrationNumber).includes(plate)
      );
    });
  }, [violations, filter, query]);

  const selected = violations.find((item) => item.id === selectedViolationId) ?? null;

  return (
    <Page>
      <PageHeader
        group={copy.group}
        title={copy.title}
        description={copy.description}
        status={
          <>
            <HeaderStat label="Records" value={j.number(counts.all)} />
            <HeaderStat label="Verified" value={j.number(counts.verified)} tone="ok" />
            <HeaderStat
              label="Pending"
              value={j.number(counts.pending)}
              tone={counts.pending > 0 ? "warn" : "ok"}
            />
          </>
        }
      />

      <PageBody className="flex flex-col gap-3 overflow-hidden p-3.5">
        <MetricStrip4 className="shrink-0">
          <MetricCell label="Records held" value={j.number(counts.all)} caption="Signed evidence in this session" />
          <MetricCell
            label="Backend verified"
            value={j.number(counts.verified)}
            caption="Cleared every verification gate"
            tone="ok"
          />
          <MetricCell
            label="Queued for upload"
            value={j.number(counts.pending)}
            caption="Signed locally, awaiting connectivity"
            tone={counts.pending > 0 ? "warn" : "ok"}
          />
          <MetricCell
            label="Signed offline"
            value={j.number(counts.offline)}
            caption="Created with no network route"
            tone="info"
          />
        </MetricStrip4>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Event ID or registration"
            className="w-full max-w-xs"
            aria-label="Filter evidence records"
          />
          <Segmented<Filter>
            ariaLabel="Filter by verification state"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All", count: counts.all },
              { value: "verified", label: "Verified", count: counts.verified },
              { value: "pending", label: "Pending upload", count: counts.pending },
              { value: "offline", label: "Signed offline", count: counts.offline },
            ]}
          />
          <span className="t-meta ml-auto">{j.number(filtered.length)} shown</span>
        </div>

        <div className="grid min-h-0 flex-1 gap-3 2xl:grid-cols-[minmax(0,1fr)_460px]">
          <Panel className="min-h-0">
            <PanelHead
              title="Evidence register"
              icon={<ScrollText className="h-3.5 w-3.5" />}
              meta="Signed records only"
            />
            <DataTable
              caption="Violation evidence register"
              rows={filtered}
              rowKey={(row) => row.id}
              onRowClick={(row) => selectViolation(row.id)}
              selectedKey={selectedViolationId}
              severityOf={(row) => (row.level === "L1" ? "warn" : "crit")}
              className="min-h-0 flex-1"
              defaultSort={{ key: "time", direction: "desc" }}
              emptyState={
                <EmptyState
                  icon={<FileSearch className="h-4 w-4" />}
                  title="No evidence records match"
                  description={
                    query
                      ? `Nothing matches “${query}” in this view.`
                      : "No record in the register is currently in this state."
                  }
                  action={
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setFilter("all");
                        setQuery("");
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              }
              columns={[
                {
                  key: "id",
                  header: "Event ID",
                  variant: "mono",
                  sortBy: (row) => row.id,
                  render: (row) => row.id,
                },
                {
                  key: "vehicle",
                  header: "Vehicle",
                  sortBy: (row) => row.registrationNumber,
                  render: (row) => <IdentityCell title={row.registrationNumber} subtitle={row.roadName} />,
                },
                {
                  key: "speed",
                  header: "Speed / limit",
                  variant: "num",
                  sortBy: (row) => row.gpsSpeed,
                  render: (row) => (
                    <SpeedCell speed={row.gpsSpeed} limit={row.roadLimit} tolerance={row.tolerance} />
                  ),
                },
                {
                  key: "excess",
                  header: "Excess",
                  variant: "num",
                  hideBelow: "lg",
                  sortBy: (row) => row.gpsSpeed - row.roadLimit,
                  render: (row) => (
                    <span className="t-mono text-[var(--crit-text)]">
                      +{j.speedValue(row.gpsSpeed - row.roadLimit)}
                    </span>
                  ),
                },
                {
                  key: "duration",
                  header: "Sustained",
                  variant: "num",
                  hideBelow: "xl",
                  sortBy: (row) => row.durationSec,
                  render: (row) => `${row.durationSec}s`,
                },
                {
                  key: "level",
                  header: "Level",
                  sortBy: (row) => row.level,
                  render: (row) => (
                    <StatusBadge tone={levelTone(row.level)} solid={row.level !== "L1"}>
                      {row.level}
                    </StatusBadge>
                  ),
                },
                {
                  key: "verification",
                  header: "Verification",
                  hideBelow: "md",
                  sortBy: (row) => row.backendVerification,
                  render: (row) => (
                    <VerificationState
                      verified={row.backendVerification === "PASSED"}
                      verifiedLabel="Backend verified"
                      pendingLabel={row.uploadStatus === "QUEUED" ? "Signed, queued" : "Awaiting verification"}
                    />
                  ),
                },
                {
                  key: "time",
                  header: "Captured",
                  hideBelow: "sm",
                  sortBy: (row) => row.timestamp,
                  render: (row) => <span className="t-mono-sm text-[var(--text-3)]">{j.time(row.timestamp)}</span>,
                },
              ]}
            />
          </Panel>

          {/* The record's own argument, docked on very wide displays. */}
          <EvidencePane violation={selected} onClose={() => selectViolation(null)} />
        </div>
      </PageBody>

      {/* Below 2xl the same record opens as a drawer instead of being squeezed
          into a column too narrow to argue in. */}
      <EvidenceDrawer className="2xl:hidden" />
    </Page>
  );
}

function EvidencePane({
  violation,
  onClose,
}: Readonly<{ violation: ViolationEvent | null; onClose: () => void }>) {
  if (!violation) {
    return (
      <Panel className="hidden min-h-0 2xl:flex">
        <PanelHead title="Evidence record" />
        <EmptyState
          icon={<FileSearch className="h-4 w-4" />}
          title="No record selected"
          description="Select an event from the register to inspect its rule evaluation, cryptographic proof and chain of custody."
        />
      </Panel>
    );
  }

  return (
    <DetailPane
      eyebrow="Signed evidence record"
      title={violation.id}
      onClose={onClose}
      tone={violation.backendVerification === "PASSED" ? undefined : "warn"}
      className="hidden min-h-0 2xl:flex"
    >
      <EvidenceBody violation={violation} />
    </DetailPane>
  );
}

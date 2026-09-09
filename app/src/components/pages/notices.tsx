"use client";

import { useMemo, useState } from "react";
import { FileText, MessageSquare } from "lucide-react";
import { Page, PageBody, PageHeader, HeaderStat } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHead, Field, FieldGrid } from "@/components/ui/panel";
import { DataTable, IdentityCell } from "@/components/ui/data-table";
import { Button, Segmented } from "@/components/ui/button";
import { StatusBadge, VerificationState } from "@/components/ui/status";
import { ConditionState, EmptyState } from "@/components/ui/states";
import { DetailPane } from "@/components/ui/drawer";
import { Timeline, type TimelineStep } from "@/components/ui/timeline";
import { EvidenceDrawer } from "@/components/violations/evidence-drawer";
import { copyFor } from "@/components/layout/nav-config";
import { useSimulationStore } from "@/store/simulation-store";
import { useJurisdiction } from "@/lib/use-jurisdiction";
import { toneOf } from "@/lib/status";
import type { Notice, NoticeStatus } from "@/lib/types";

/**
 * THE NOTICE WORKFLOW
 *
 * A workflow system, not a payment app. The single thing this screen must make
 * unmissable is the gate: a notice cannot exist before its evidence has been
 * verified by the backend. So eligibility is stated on the record itself, and a
 * notice whose evidence has not cleared verification shows the block and the
 * reason rather than a disabled button with no explanation.
 *
 * Terminology is jurisdictional. The product concept is "Notice"; what the
 * local authority calls it — a traffic challan, a fine, a notice of intended
 * prosecution — comes from the jurisdiction and appears only where the notice
 * type is being described.
 */

type Stage = "all" | "verified" | "review" | "eligible" | "generated" | "closed";

const STAGE_OF: Record<NoticeStatus, Exclude<Stage, "all">> = {
  "Pending Verification": "verified",
  Verified: "eligible",
  "Under Review": "review",
  "Warning Only": "review",
  "Appeal Submitted": "review",
  "Notice Generated": "generated",
  Closed: "closed",
};

export function NoticesPage() {
  const copy = copyFor("/challan-notices");
  const j = useJurisdiction();
  const notices = useSimulationStore((state) => state.notices);
  const violations = useSimulationStore((state) => state.violations);
  const selectedNoticeId = useSimulationStore((state) => state.selectedNoticeId);
  const selectNotice = useSimulationStore((state) => state.selectNotice);
  const selectViolation = useSimulationStore((state) => state.selectViolation);
  const [stage, setStage] = useState<Stage>("all");

  const counts = useMemo(() => {
    const result: Record<Stage, number> = {
      all: notices.length,
      verified: 0,
      review: 0,
      eligible: 0,
      generated: 0,
      closed: 0,
    };
    for (const notice of notices) result[STAGE_OF[notice.status]] += 1;
    return result;
  }, [notices]);

  const filtered = stage === "all" ? notices : notices.filter((notice) => STAGE_OF[notice.status] === stage);
  const selected = notices.find((notice) => notice.id === selectedNoticeId) ?? null;
  const linkedViolation = selected ? violations.find((item) => item.id === selected.violationId) ?? null : null;
  const eligible = linkedViolation?.backendVerification === "PASSED";

  /** The pipeline, with each stage's live population. */
  const pipeline: TimelineStep[] = [
    {
      label: "Verified evidence",
      detail: `${j.number(counts.verified)} awaiting backend verification`,
      state: "done",
    },
    { label: "Review", detail: `${j.number(counts.review)} under review or appeal`, state: "done" },
    { label: "Notice eligible", detail: `${j.number(counts.eligible)} cleared for generation`, state: "done" },
    { label: "Notice generated", detail: `${j.number(counts.generated)} issued`, state: "done" },
    { label: "Delivered / closed", detail: `${j.number(counts.closed)} closed`, state: counts.closed > 0 ? "done" : "pending" },
  ];

  return (
    <Page>
      <PageHeader
        group={copy.group}
        title={copy.title}
        description={copy.description}
        status={
          <>
            <HeaderStat label="Notices" value={j.number(counts.all)} />
            <HeaderStat label="Generated" value={j.number(counts.generated)} tone="ok" />
            <HeaderStat label="Blocked" value={j.number(counts.verified)} tone={counts.verified > 0 ? "warn" : "ok"} />
          </>
        }
        actions={<StatusBadge tone="warn">Prototype workflow</StatusBadge>}
      />

      <PageBody className="flex flex-col gap-3 overflow-hidden p-3.5">
        <Panel className="shrink-0">
          <PanelHead title="Notice pipeline" meta={`Notice type: ${j.noticeTerm}`} icon={<FileText className="h-3.5 w-3.5" />} />
          <PanelBody pad="md">
            <Timeline steps={pipeline} orientation="horizontal" />
          </PanelBody>
        </Panel>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Segmented<Stage>
            ariaLabel="Filter by workflow stage"
            value={stage}
            onChange={setStage}
            options={[
              { value: "all", label: "All", count: counts.all },
              { value: "verified", label: "Awaiting verification", count: counts.verified },
              { value: "review", label: "Review", count: counts.review },
              { value: "eligible", label: "Eligible", count: counts.eligible },
              { value: "generated", label: "Generated", count: counts.generated },
            ]}
          />
          <span className="t-meta ml-auto">{j.number(filtered.length)} shown</span>
        </div>

        <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_400px]">
          <Panel className="min-h-0">
            <PanelHead title="Notice register" />
            <DataTable
              caption="Enforcement notice register"
              rows={filtered}
              rowKey={(row) => row.id}
              onRowClick={(row) => selectNotice(row.id)}
              selectedKey={selectedNoticeId}
              className="min-h-0 flex-1"
              emptyState={
                <EmptyState
                  icon={<FileText className="h-4 w-4" />}
                  title="No notices at this stage"
                  description="Notices appear here once their evidence has been signed and submitted for verification."
                  action={
                    <Button size="sm" variant="secondary" onClick={() => setStage("all")}>
                      Show all
                    </Button>
                  }
                />
              }
              columns={[
                { key: "id", header: "Notice ID", variant: "mono", sortBy: (row) => row.id, render: (row) => row.id },
                {
                  key: "vehicle",
                  header: "Vehicle",
                  sortBy: (row) => row.registrationNumber,
                  render: (row) => <IdentityCell title={row.registrationNumber} />,
                },
                {
                  key: "evidence",
                  header: "Linked evidence",
                  variant: "mono",
                  hideBelow: "md",
                  render: (row) => (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        selectViolation(row.violationId);
                      }}
                      className="t-mono text-[var(--brand-text)] underline-offset-2 hover:underline"
                    >
                      {row.violationId}
                    </button>
                  ),
                },
                {
                  key: "verification",
                  header: "Verification",
                  hideBelow: "lg",
                  render: (row) => {
                    const violation = violations.find((item) => item.id === row.violationId);
                    return (
                      <VerificationState
                        verified={violation?.backendVerification === "PASSED"}
                        pendingLabel="Not verified"
                      />
                    );
                  },
                },
                {
                  key: "status",
                  header: "Status",
                  sortBy: (row) => row.status,
                  render: (row) => <StatusBadge tone={toneOf(row.status)}>{row.status}</StatusBadge>,
                },
                {
                  key: "time",
                  header: "Issued",
                  hideBelow: "sm",
                  sortBy: (row) => row.timestamp,
                  render: (row) => <span className="t-mono-sm text-[var(--text-3)]">{j.dateTime(row.timestamp)}</span>,
                },
              ]}
            />
          </Panel>

          {selected ? (
            <DetailPane
              eyebrow="Enforcement notice"
              title={selected.id}
              onClose={() => selectNotice(null)}
              tone={eligible ? undefined : "warn"}
              className="hidden min-h-0 xl:flex"
            >
              <NoticeBody notice={selected} eligible={eligible} />
            </DetailPane>
          ) : (
            <Panel className="hidden min-h-0 xl:flex">
              <PanelHead title="Notice record" />
              <EmptyState
                icon={<FileText className="h-4 w-4" />}
                title="No notice selected"
                description="Select a record to see its eligibility, linked evidence and the citizen notification it would produce."
              />
            </Panel>
          )}
        </div>
      </PageBody>

      <EvidenceDrawer />
    </Page>
  );
}

function NoticeBody({ notice, eligible }: Readonly<{ notice: Notice; eligible: boolean }>) {
  const j = useJurisdiction();
  const violation = useSimulationStore((state) =>
    state.violations.find((item) => item.id === notice.violationId),
  );

  return (
    <div>
      {/* The gate, stated first. This is the screen's whole argument. */}
      <section className="border-b border-[var(--line)] px-4 py-3.5">
        <p className="t-label mb-2">Eligibility</p>
        {eligible ? (
          <ConditionState
            tone="ok"
            title="Cleared for notice generation"
            description="The linked evidence record passed backend verification. Notice generation is permitted under authority policy."
          />
        ) : (
          <ConditionState
            tone="warn"
            title="Blocked — evidence not verified"
            description="A notice cannot be generated until the linked evidence record clears backend verification. This gate is enforced by the workflow, not by the operator."
          />
        )}
      </section>

      <section className="border-b border-[var(--line)] px-4 py-3.5">
        <p className="t-label mb-2.5">Record</p>
        <FieldGrid columns={2}>
          <Field label="Notice ID" value={notice.id} mono />
          <Field label="Notice type" value={j.noticeTerm} />
          <Field label="Vehicle" value={notice.registrationNumber} mono />
          <Field label="Linked evidence" value={notice.violationId} mono />
          <Field label="Issued" value={j.dateTime(notice.timestamp)} mono />
          <Field
            label="Verification"
            value={notice.verificationStatus}
            mono
            tone={eligible ? "ok" : "warn"}
          />
          <Field label="Issuing office" value={j.issuingOffice} className="col-span-2" />
        </FieldGrid>
        <p className="t-meta mt-2.5 leading-snug">{notice.summary}</p>
      </section>

      {/* Simulated citizen notification, marked as simulated. */}
      <section className="px-4 py-3.5">
        <p className="t-label mb-2">Citizen notification preview</p>
        <div className="hatch-demo overflow-hidden rounded-[var(--r-md)] border border-[var(--warn-line)]">
          <div className="flex items-center gap-2 border-b border-[var(--line)] bg-[var(--panel-sunken)] px-3 py-2">
            <span className="grid h-6 w-6 flex-none place-items-center rounded-[var(--r-xs)] bg-[var(--brand)] text-[var(--brand-on)]">
              <MessageSquare className="h-3 w-3" strokeWidth={2.2} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[12px] font-semibold text-[var(--text)]">BlueBox One</span>
              <span className="t-mono-sm block truncate text-[var(--text-4)]">Road safety notification</span>
            </span>
            <StatusBadge tone="warn" className="ml-auto">
              Simulated
            </StatusBadge>
          </div>

          <div className="space-y-1 px-3 py-3 text-[12px] leading-relaxed text-[var(--text-2)]">
            <p className="font-medium text-[var(--text)]">Vehicle: {notice.registrationNumber}</p>
            <p>Overspeed event recorded.</p>
            {violation ? (
              <>
                <p className="t-mono">Recorded speed: {j.speed(violation.gpsSpeed)}</p>
                <p className="t-mono">Road limit: {j.speed(violation.roadLimit)}</p>
                <p>Location: {violation.roadName}</p>
                <p className="t-mono">{j.dateTime(violation.timestamp)}</p>
              </>
            ) : null}
            <p className={eligible ? "text-[var(--ok-text)]" : "text-[var(--warn-text)]"}>
              Status: {eligible ? "Evidence verified." : "Awaiting verification."}
            </p>
          </div>

          <p className="border-t border-[var(--line)] px-3 py-2 text-[10.5px] leading-snug text-[var(--text-4)]">
            Simulated preview only. No message is sent, no payment URL is generated, and the final penalty is
            determined by authority enforcement policy — not by this record or by the device.
          </p>
        </div>
      </section>
    </div>
  );
}

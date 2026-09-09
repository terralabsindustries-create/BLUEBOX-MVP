"use client";

import { useMemo } from "react";
import { Radio, Workflow } from "lucide-react";
import { Panel, PanelBody, PanelHead } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge, StatusDot } from "@/components/ui/status";
import { EventStream, Timeline, type TimelineStep } from "@/components/ui/timeline";
import { useJurisdiction } from "@/lib/use-jurisdiction";
import { useSimulationStore } from "@/store/simulation-store";
import type { StatusTone } from "@/lib/status";
import type { ActivityItem, FlowStage } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * THE OPERATIONS LOG AND THE MACHINE BEHIND IT
 *
 * Two views of the same run of the enforcement rule. The feed is what the
 * engine *said*; the pipeline is where the engine currently *is*. Both are
 * shared between the Overview and Live Operations, because two screens
 * narrating the same event differently is exactly how an operator stops
 * trusting either one.
 */

/* -------------------------------------------------------------------------- */
/* Activity feed                                                              */
/* -------------------------------------------------------------------------- */

/**
 * `info` is deliberately grey rather than cyan. Most of what the engine writes
 * is routine narration, and if every line carried a status colour the two that
 * matter — a qualification starting, an event being created — would not stand
 * out at a glance.
 */
const ACTIVITY_TONE: Record<ActivityItem["severity"], StatusTone> = {
  critical: "crit",
  warning: "warn",
  success: "ok",
  info: "idle",
};

/**
 * Presenter announcements are narrated by the operator, not reported by a
 * device, so they must never be attributed to one. Everything else the store
 * writes to `activity` comes from the rule engine running against the single
 * instrumented vehicle, which is why those lines carry its registration even
 * when the message text does not repeat it.
 */
const OPERATOR_LINE = /^scenario\b/i;

function attribute(item: ActivityItem, registration: string | undefined) {
  if (!registration || OPERATOR_LINE.test(item.message)) {
    return { subject: undefined, message: item.message };
  }
  if (!item.message.startsWith(registration)) {
    return { subject: registration, message: item.message };
  }
  // The seeded log repeats the plate inline. Lift it into the subject rather
  // than printing the same identifier twice on one entry.
  const rest = item.message.slice(registration.length).trim();
  return {
    subject: registration,
    message: rest ? `${rest.charAt(0).toUpperCase()}${rest.slice(1)}` : item.message,
  };
}

/**
 * The live activity stream.
 *
 * Scrolls inside its own body, so the panel can be dropped into a fixed-height
 * grid cell without the page growing under it. Pass `limit` where the feed is
 * a summary beside other panels rather than the primary surface.
 */
export function ActivityFeed({ limit, className }: Readonly<{ limit?: number; className?: string }>) {
  const j = useJurisdiction();
  const activity = useSimulationStore((state) => state.activity);
  const registration = useSimulationStore(
    (state) => (state.vehicles.find((vehicle) => vehicle.id === "vehicle-1") ?? state.vehicles[0])?.registrationNumber,
  );

  const entries = useMemo(
    () =>
      (typeof limit === "number" ? activity.slice(0, limit) : activity).map((item) => {
        const { subject, message } = attribute(item, registration);
        return {
          id: item.id,
          timestamp: j.time(item.timestamp),
          tone: ACTIVITY_TONE[item.severity],
          subject,
          message,
        };
      }),
    [activity, j, limit, registration],
  );

  const truncated = entries.length < activity.length;

  return (
    <Panel className={cn("min-h-0", className)}>
      <PanelHead
        title="Live Activity"
        icon={<Radio className="h-3.5 w-3.5" />}
        meta={j.environment}
        actions={
          <span className="flex items-center gap-1.5">
            <StatusDot tone={entries.length > 0 ? "ok" : "idle"} live={entries.length > 0} />
            <span className="t-mono-sm text-[var(--text-3)]">
              {truncated ? `${entries.length} of ${activity.length}` : entries.length} entries
            </span>
          </span>
        }
      />

      {entries.length === 0 ? (
        <PanelBody className="flex flex-1 items-center justify-center">
          <EmptyState
            compact
            icon={<Radio className="h-4 w-4" />}
            title="No activity recorded"
            description="The rule engine writes every evaluation here — qualification, signing, queueing and upload — as the simulation produces it."
          />
        </PanelBody>
      ) : (
        <PanelBody pad="none" scroll>
          <EventStream items={entries} />
        </PanelBody>
      )}
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/* Event pipeline                                                             */
/* -------------------------------------------------------------------------- */

/** The `FlowStage` union in its declared order — the machine's own sequence. */
const FLOW_STAGES: readonly FlowStage[] = [
  "GNSS DATA",
  "SPEED RULE",
  "TOLERANCE CHECK",
  "DURATION CHECK",
  "GPS QUALITY",
  "CREATE EVENT",
  "SIGN EVENT",
  "NETWORK?",
  "QUEUE LOCALLY",
  "RETRY",
  "UPLOAD",
  "BACKEND VERIFY",
  "SIMULATED NOTICE",
];

/**
 * Custody bands.
 *
 * The device detects, qualifies and signs; it does not verify its own evidence
 * and it never decides a penalty. Banding the stages by who owns them draws
 * that handover instead of leaving a reader to infer it from thirteen
 * identically-weighted dots. Each band is anchored to the stage it begins at,
 * so the bands cannot drift out of step with the sequence above.
 */
const BANDS = (
  [
    { label: "Device", from: "GNSS DATA" },
    { label: "Transport", from: "NETWORK?" },
    { label: "Backend", from: "BACKEND VERIFY" },
    { label: "Policy", from: "SIMULATED NOTICE" },
  ] as const satisfies readonly { label: string; from: FlowStage }[]
).map((band, index, all) => {
  const start = FLOW_STAGES.indexOf(band.from);
  const end = index + 1 < all.length ? FLOW_STAGES.indexOf(all[index + 1].from) : FLOW_STAGES.length;
  return { label: band.label, start, span: end - start };
});

/**
 * The enforcement state machine, with the current stage marked.
 *
 * Stages already passed stay visible rather than collapsing: the value of this
 * panel is that a reader can see the whole chain a single event has to clear,
 * not just the step it is on. It scrolls inside its own container below roughly
 * 900px so the thirteen labels never crush into each other.
 */
export function EventPipeline({ className }: Readonly<{ className?: string }>) {
  const flowStage = useSimulationStore((state) => state.flowStage);
  const current = Math.max(0, FLOW_STAGES.indexOf(flowStage));

  const steps: TimelineStep[] = FLOW_STAGES.map((stage, index) => ({
    label: stage,
    state: index < current ? "done" : index === current ? "active" : "pending",
  }));

  return (
    <Panel className={className}>
      <PanelHead
        title="Event Pipeline"
        icon={<Workflow className="h-3.5 w-3.5" />}
        meta={`Stage ${current + 1} of ${FLOW_STAGES.length}`}
        actions={
          <StatusBadge tone="brand" dot>
            {FLOW_STAGES[current]}
          </StatusBadge>
        }
      />

      <PanelBody pad="sm" className="flex flex-1 items-center">
        <div className="scroll-x w-full pb-1">
          <div className="min-w-[880px]">
            <div className="grid" style={{ gridTemplateColumns: `repeat(${FLOW_STAGES.length}, minmax(0, 1fr))` }}>
              {BANDS.map((band) => (
                <p
                  key={band.label}
                  style={{ gridColumn: `span ${band.span}` }}
                  className={cn(
                    "t-label truncate border-l border-t border-[var(--line)] px-1 pt-1 text-center first:border-l-0",
                    current >= band.start ? "text-[var(--text-3)]" : "text-[var(--text-4)]",
                  )}
                >
                  {band.label}
                </p>
              ))}
            </div>
            <Timeline orientation="horizontal" steps={steps} className="mt-1.5" />
          </div>
        </div>
      </PanelBody>
    </Panel>
  );
}

"use client";

import { useMemo } from "react";
import { Area, AreaChart, Bar, BarChart, Cell, LabelList, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Gauge, MapPin, ShieldAlert } from "lucide-react";
import {
  AreaGradient,
  AxisX,
  AxisY,
  BarTooltip,
  ChartFrame,
  ChartLegend,
  Grid,
  LineTooltip,
  SeriesReadout,
  chartColors,
  chartTheme,
} from "@/components/ui/chart-kit";
import { Panel, PanelBody, PanelHead } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { Meter } from "@/components/ui/status";
import { type OperationalTone, levelTone } from "@/lib/status";
import { speedRule } from "@/lib/rules/speed-rule";
import type { ViolationLevel } from "@/lib/types";
import { useJurisdiction } from "@/lib/use-jurisdiction";
import { cn, enforcementStateOf, percent } from "@/lib/utils";
import { useSimulationStore } from "@/store/simulation-store";

/**
 * SHARED PLOTS
 *
 * Overview, Violations and Analytics all answer the same four questions —
 * when, how severe, where, and how is the fleet — so they ask them with the
 * same five components rather than three near-identical chart implementations
 * that can drift apart. A reviewer who learns to read the severity bars on
 * Violations reads the identical bars on Analytics.
 *
 * Every mark takes its colour from the status vocabulary, so a red bar and a
 * red chip mean the same thing. Nothing here invents a scale.
 */

/** Chart fill for a status tone. The chart and the chip agree by construction. */
const TONE_FILL: Record<OperationalTone, string> = {
  ok: chartColors.ok,
  info: chartColors.info,
  warn: chartColors.warn,
  crit: chartColors.crit,
  tamper: chartColors.tamper,
  idle: chartColors.idle,
};

/* -------------------------------------------------------------------------- */
/* Violation trend                                                            */
/* -------------------------------------------------------------------------- */

/**
 * An hourly profile is only meaningful once the recorded events actually span
 * several hours. The seeded dataset covers a short window, so below this many
 * distinct buckets the chart shows the illustrative profile instead — and says
 * so — rather than drawing a flat line and implying the roads were empty.
 */
const MIN_DERIVED_BUCKETS = 5;

/** Illustrative hourly shape. Never presented as a recorded reading. */
const DEMONSTRATION_TREND: readonly { hour: number; count: number }[] = [
  { hour: 0, count: 18 },
  { hour: 1, count: 11 },
  { hour: 2, count: 8 },
  { hour: 3, count: 7 },
  { hour: 4, count: 12 },
  { hour: 5, count: 26 },
  { hour: 6, count: 48 },
  { hour: 7, count: 82 },
  { hour: 8, count: 118 },
  { hour: 9, count: 104 },
  { hour: 10, count: 76 },
  { hour: 11, count: 64 },
  { hour: 12, count: 61 },
  { hour: 13, count: 58 },
  { hour: 14, count: 63 },
  { hour: 15, count: 71 },
  { hour: 16, count: 92 },
  { hour: 17, count: 126 },
  { hour: 18, count: 141 },
  { hour: 19, count: 117 },
  { hour: 20, count: 88 },
  { hour: 21, count: 64 },
  { hour: 22, count: 42 },
  { hour: 23, count: 27 },
];

function hourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function ViolationTrendChart({ height = 208, className }: Readonly<{ height?: number; className?: string }>) {
  const j = useJurisdiction();
  const violations = useSimulationStore((state) => state.violations);

  const { data, derived, total, peak } = useMemo(() => {
    const counts = new Map<number, number>();
    for (const violation of violations) {
      // The hour comes back through the jurisdiction's own clock, so a
      // deployment five zones away buckets its evenings, not ours.
      const hour = Number(j.time(violation.timestamp, false).slice(0, 2)) % 24;
      if (Number.isNaN(hour)) continue;
      counts.set(hour, (counts.get(hour) ?? 0) + 1);
    }

    const hours = [...counts.keys()].sort((a, b) => a - b);
    const isDerived = hours.length >= MIN_DERIVED_BUCKETS;
    const source = isDerived
      ? Array.from({ length: hours[hours.length - 1] - hours[0] + 1 }, (_, offset) => {
          const hour = hours[0] + offset;
          return { hour, count: counts.get(hour) ?? 0 };
        })
      : DEMONSTRATION_TREND;

    const points = source.map((point) => ({ label: hourLabel(point.hour), count: point.count }));
    const peakPoint = points.reduce((best, point) => (point.count > best.count ? point : best), points[0]);

    return {
      data: points,
      derived: isDerived,
      total: points.reduce((sum, point) => sum + point.count, 0),
      peak: peakPoint,
    };
  }, [violations, j]);

  return (
    <ChartFrame
      title="Violation trend"
      caption={
        derived
          ? `Hourly buckets · ${j.number(total)} recorded events`
          : `Illustrative hourly profile · ${j.environment.toLowerCase()} data`
      }
      aside={
        <span className="t-mono-sm text-[var(--text-4)]">
          Peak {peak.label} · {j.number(peak.count)}
        </span>
      }
      height={height}
      className={className}
    >
      {/* The hatch is the product's marker for a region that is not a reading. */}
      <div className={cn("h-full w-full", !derived && "hatch-demo")}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 10, bottom: 0, left: -4 }}>
            <AreaGradient id="bb-violation-trend" />
            <Grid />
            <AxisX dataKey="label" interval={data.length > 12 ? 2 : 0} />
            <AxisY width={46} allowDecimals={false} />
            <LineTooltip unit="events" />
            <Area
              type="monotone"
              dataKey="count"
              name="Violations"
              stroke={chartColors.primary}
              strokeWidth={1.6}
              fill="url(#bb-violation-trend)"
              dot={false}
              activeDot={{ r: 3, fill: chartColors.primary, stroke: chartTheme.surface, strokeWidth: 1.5 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

/* -------------------------------------------------------------------------- */
/* Severity distribution                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The rule's bands, in the device's native storage unit. They are stored
 * unconverted and rendered through `j.speed()`, which is what lets an imperial
 * deployment read the same enforcement logic in its own unit.
 */
const LEVEL_BANDS: readonly { level: ViolationLevel; from: number; to?: number }[] = [
  { level: "L1", from: speedRule.triggerSpeed, to: 95 },
  { level: "L2", from: 96, to: 110 },
  { level: "L3", from: 110 },
];

export function SeverityDistributionChart({ height = 190, className }: Readonly<{ height?: number; className?: string }>) {
  const j = useJurisdiction();
  const violations = useSimulationStore((state) => state.violations);

  const data = useMemo(
    () =>
      LEVEL_BANDS.map((band) => ({
        level: band.level,
        count: violations.reduce((sum, violation) => sum + (violation.level === band.level ? 1 : 0), 0),
        fill: TONE_FILL[levelTone(band.level)],
      })),
    [violations],
  );

  const bandLabel = (band: (typeof LEVEL_BANDS)[number]) =>
    band.to === undefined ? `Above ${j.speed(band.from)}` : `${j.speedValue(band.from)}–${j.speed(band.to)}`;

  return (
    <ChartFrame
      title="Severity distribution"
      caption={`Qualified events by level · ${j.number(violations.length)} total`}
      height={height}
      className={className}
      footer={
        <ChartLegend
          items={LEVEL_BANDS.map((band, index) => ({
            label: `${band.level} · ${bandLabel(band)}`,
            color: TONE_FILL[levelTone(band.level)],
            value: j.number(data[index].count),
          }))}
        />
      }
    >
      {violations.length === 0 ? (
        <EmptyState
          compact
          className="h-full"
          icon={<ShieldAlert className="h-4 w-4" />}
          title="No qualified events"
          description="Nothing has cleared the speed rule in the current dataset."
        />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 18, right: 10, bottom: 0, left: -18 }} barCategoryGap="38%">
            <Grid />
            <AxisX dataKey="level" />
            <AxisY width={46} allowDecimals={false} />
            <BarTooltip unit="events" labelPrefix="Level" />
            <Bar dataKey="count" name="Events" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {data.map((entry) => (
                <Cell key={entry.level} fill={entry.fill} />
              ))}
              <LabelList
                dataKey="count"
                position="top"
                offset={7}
                fill={chartTheme.axis}
                fontSize={10.5}
                formatter={(value) => (typeof value === "number" ? j.number(value) : value)}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartFrame>
  );
}

/* -------------------------------------------------------------------------- */
/* Device status                                                              */
/* -------------------------------------------------------------------------- */

export function DeviceStatusChart({ className }: Readonly<{ className?: string }>) {
  const j = useJurisdiction();
  const metrics = useSimulationStore((state) => state.metrics);

  const segments = useMemo(
    () => [
      { label: "Online", value: metrics.onlineDevices, color: chartColors.ok },
      { label: "Offline", value: metrics.offlineDevices, color: chartColors.idle },
      { label: "Tamper alerts", value: metrics.tamperAlerts, color: chartColors.tamper },
      { label: "Not reporting", value: metrics.noDataDevices, color: chartColors.comparison },
    ],
    [metrics],
  );

  // Totalled from the segments rather than read from `totalDevices`, so the
  // centre percentage can never disagree with the ring drawn around it.
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const onlineShare = total > 0 ? (metrics.onlineDevices / total) * 100 : 0;

  return (
    <ChartFrame
      title="Device fleet state"
      caption={`${j.number(total)} devices reporting into the platform`}
      height={172}
      className={className}
      footer={<SeriesReadout items={segments} total={total} />}
    >
      <div className="relative h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <BarTooltip unit="devices" />
            <Pie
              data={segments}
              dataKey="value"
              nameKey="label"
              innerRadius="66%"
              outerRadius="92%"
              paddingAngle={1.5}
              stroke={chartTheme.surface}
              strokeWidth={1}
              isAnimationActive={false}
            >
              {segments.map((segment) => (
                <Cell key={segment.label} fill={segment.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="t-metric text-[var(--ok-text)]">{onlineShare.toFixed(1)}%</p>
            <p className="t-label mt-1">Online</p>
          </div>
        </div>
      </div>
    </ChartFrame>
  );
}

/* -------------------------------------------------------------------------- */
/* Top locations                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Where enforcement is concentrating. A ranked list rather than a plot: the
 * operator's next question is always "which road", and a road name is a label,
 * not a coordinate on an axis.
 */
export function TopLocationsPanel({
  action,
  limit = 6,
  className,
}: Readonly<{ action?: React.ReactNode; limit?: number; className?: string }>) {
  const j = useJurisdiction();
  const violations = useSimulationStore((state) => state.violations);

  const { rows, leader, total } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const violation of violations) {
      counts.set(violation.roadName, (counts.get(violation.roadName) ?? 0) + 1);
    }
    const ranked = [...counts.entries()]
      .map(([road, count]) => ({ road, count }))
      .sort((a, b) => b.count - a.count || a.road.localeCompare(b.road));

    return {
      rows: ranked.slice(0, limit),
      leader: ranked[0]?.count ?? 0,
      total: violations.length,
    };
  }, [violations, limit]);

  return (
    <Panel className={className}>
      <PanelHead
        title="Violation hotspots"
        meta={rows.length > 0 ? `Top ${j.number(rows.length)}` : undefined}
        icon={<MapPin className="h-3.5 w-3.5" />}
        actions={action}
      />
      <PanelBody pad="none">
        {rows.length === 0 ? (
          <EmptyState
            compact
            icon={<MapPin className="h-4 w-4" />}
            title="No hotspots recorded"
            description="No qualified event has been attributed to a road segment yet."
          />
        ) : (
          <ol className="divide-y divide-[var(--line-soft)]">
            {rows.map((row, index) => (
              <li key={row.road} className="px-3 py-2">
                <div className="flex items-baseline gap-2">
                  <span className="t-mono-sm w-5 shrink-0 text-[var(--text-4)]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--text-2)]">{row.road}</span>
                  <span className="t-num shrink-0 text-[12.5px] font-semibold text-[var(--text)]">
                    {j.number(row.count)}
                  </span>
                  <span className="t-num w-12 shrink-0 text-right text-[11px] text-[var(--text-4)]">
                    {percent(row.count, total)}
                  </span>
                </div>
                {/* Bar is scaled to the leading road, so the ranking is the
                    magnitude channel and the percentage stays the absolute one. */}
                <Meter
                  className="mt-1.5"
                  value={row.count}
                  max={leader}
                  tone="crit"
                  label={`${row.road} — ${row.count} events`}
                />
              </li>
            ))}
          </ol>
        )}
      </PanelBody>
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/* Speed compliance                                                           */
/* -------------------------------------------------------------------------- */

const COMPLIANCE_SERIES = [
  { key: "normal", label: "Normal", tone: "ok" },
  { key: "near", label: "Near threshold", tone: "warn" },
  { key: "qualified", label: "Qualified violation", tone: "crit" },
] as const;

export function SpeedComplianceChart({ height = 214, className }: Readonly<{ height?: number; className?: string }>) {
  const j = useJurisdiction();
  const vehicles = useSimulationStore((state) => state.vehicles);

  const { rows, totals, excluded } = useMemo(() => {
    const byRoad = new Map<string, { road: string; normal: number; near: number; qualified: number }>();
    let suppressed = 0;

    for (const vehicle of vehicles) {
      const state = enforcementStateOf(vehicle);
      // An offline or tampered device is not a compliant device — it is a
      // device with no usable reading, and counting it either way would be a
      // claim the telemetry does not support.
      if (state === "offline" || state === "tamper") {
        suppressed += 1;
        continue;
      }
      const road = vehicle.telemetry.roadName;
      const row = byRoad.get(road) ?? { road, normal: 0, near: 0, qualified: 0 };
      if (state === "normal") row.normal += 1;
      else if (state === "near") row.near += 1;
      else row.qualified += 1;
      byRoad.set(road, row);
    }

    // Ordered by what needs attention, not alphabetically.
    const ranked = [...byRoad.values()].sort(
      (a, b) => b.qualified - a.qualified || b.near - a.near || b.normal - a.normal,
    );

    return {
      rows: ranked,
      totals: ranked.reduce(
        (sum, row) => ({
          normal: sum.normal + row.normal,
          near: sum.near + row.near,
          qualified: sum.qualified + row.qualified,
        }),
        { normal: 0, near: 0, qualified: 0 },
      ),
      excluded: suppressed,
    };
  }, [vehicles]);

  return (
    <ChartFrame
      title="Speed compliance by road"
      caption={`Limit ${j.speed(speedRule.defaultRoadLimit)} · qualifies above ${j.speed(speedRule.triggerSpeed)}`}
      height={height}
      className={className}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
          <ChartLegend
            items={COMPLIANCE_SERIES.map((series) => ({
              label: series.label,
              color: TONE_FILL[series.tone],
              value: j.number(totals[series.key]),
            }))}
          />
          {excluded > 0 ? (
            <span className="t-meta text-[var(--text-4)]">
              {j.number(excluded)} excluded · offline or integrity event
            </span>
          ) : null}
        </div>
      }
    >
      {rows.length === 0 ? (
        <EmptyState
          compact
          className="h-full"
          icon={excluded > 0 ? <ShieldAlert className="h-4 w-4" /> : <Gauge className="h-4 w-4" />}
          title={excluded > 0 ? "No usable speed readings" : "No devices reporting"}
          description={
            excluded > 0
              ? "Every reporting device is offline or under an integrity event."
              : "No vehicle in the registry is currently sending telemetry."
          }
        />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 2, right: 12, bottom: 0, left: 4 }}
            barCategoryGap="34%"
          >
            <Grid vertical horizontal={false} />
            <AxisX type="number" allowDecimals={false} />
            <AxisY dataKey="road" type="category" width={138} />
            <BarTooltip unit="devices" />
            {COMPLIANCE_SERIES.map((series, index) => (
              <Bar
                key={series.key}
                dataKey={series.key}
                name={series.label}
                stackId="compliance"
                fill={TONE_FILL[series.tone]}
                radius={index === COMPLIANCE_SERIES.length - 1 ? [0, 3, 3, 0] : undefined}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartFrame>
  );
}

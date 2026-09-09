"use client";

import { CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipContentProps } from "recharts";
import { cn } from "@/lib/utils";
import { toneHex } from "@/lib/status";

/**
 * Chart marks.
 *
 * There is no separate chart palette: a bar meaning "tamper" is the same red as
 * a tamper chip, because a reviewer moving between a table and a chart should
 * not have to relearn what a colour means. The only addition is a neutral
 * comparison series, which never competes with the measured value.
 */
export const chartColors = {
  /** Single-series default: the measured value is the brand's subject. */
  primary: toneHex.brand,
  ok: toneHex.ok,
  info: toneHex.info,
  warn: toneHex.warn,
  crit: toneHex.crit,
  tamper: toneHex.tamper,
  idle: toneHex.idle,
  /** Muted reference series — last period, target, baseline. Never competes. */
  comparison: "#4A535C",
} as const;

export const chartTheme = {
  grid: "#212830",
  axis: "#626B74",
  cursor: "rgba(255, 93, 58, 0.09)",
  surface: "#15191D",
} as const;

/**
 * A note on animation: every series in this product sets
 * `isAnimationActive={false}`.
 *
 * These charts sit on a store that ticks once a second, so an entrance
 * animation is not a one-off flourish — it is a redraw an operator sees
 * repeatedly while trying to read a value off the plot. Static marks also make
 * a screenshot taken for a report identical to what was on screen.
 */

/** Recessive grid — horizontal only, so the eye follows data not scaffolding. */
export function Grid({ vertical = false, horizontal = true }: Readonly<{ vertical?: boolean; horizontal?: boolean }>) {
  return <CartesianGrid stroke={chartTheme.grid} vertical={vertical} horizontal={horizontal} />;
}

const axisTick = { fill: chartTheme.axis, fontSize: 10 } as const;

export function AxisX(props: React.ComponentProps<typeof XAxis>) {
  return <XAxis tick={axisTick} axisLine={false} tickLine={false} tickMargin={8} {...props} />;
}

export function AxisY(props: React.ComponentProps<typeof YAxis>) {
  return <YAxis tick={axisTick} axisLine={false} tickLine={false} tickMargin={6} {...props} />;
}

type ChartTooltipProps = Partial<TooltipContentProps<number, string>> & {
  unit?: string;
  labelPrefix?: string;
};

function TooltipSurface({ active, payload, label, unit, labelPrefix }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="min-w-[140px] rounded-[var(--r-sm)] border border-[var(--line)] bg-[var(--panel-raised)] px-2.5 py-2 shadow-[var(--shadow-pop)]">
      <p className="t-label">
        {labelPrefix ? `${labelPrefix} ` : ""}
        {String(label)}
      </p>
      <div className="mt-1.5 space-y-1">
        {payload.map((entry: (typeof payload)[number]) => (
          <div key={String(entry.dataKey ?? entry.name)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-[11.5px] text-[var(--text-2)]">
              <span
                aria-hidden
                className="h-2 w-2 flex-none rounded-[2px]"
                style={{ background: (entry.color as string) ?? chartColors.primary }}
              />
              {entry.name}
            </span>
            <span className="t-num text-[12px] font-semibold text-[var(--text)]">
              {typeof entry.value === "number" ? entry.value.toLocaleString("en-IN") : entry.value}
              {unit ? <span className="ml-1 text-[10px] font-normal text-[var(--text-4)]">{unit}</span> : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LineTooltip({ unit, labelPrefix }: Readonly<{ unit?: string; labelPrefix?: string }>) {
  return (
    <Tooltip
      content={(props) => <TooltipSurface {...(props as ChartTooltipProps)} unit={unit} labelPrefix={labelPrefix} />}
      cursor={{ stroke: chartColors.primary, strokeWidth: 1, strokeDasharray: "3 3", strokeOpacity: 0.5 }}
      offset={10}
    />
  );
}

export function BarTooltip({ unit, labelPrefix }: Readonly<{ unit?: string; labelPrefix?: string }>) {
  return (
    <Tooltip
      content={(props) => <TooltipSurface {...(props as ChartTooltipProps)} unit={unit} labelPrefix={labelPrefix} />}
      cursor={{ fill: chartTheme.cursor }}
      offset={10}
    />
  );
}

/** Vertical fill under a primary-series line. */
export function AreaGradient({ id, color = chartColors.primary }: Readonly<{ id: string; color?: string }>) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity={0.18} />
        <stop offset="100%" stopColor={color} stopOpacity={0.01} />
      </linearGradient>
    </defs>
  );
}

/**
 * Legend for multi-series charts. Present whenever there are two or more
 * series, so identity is never carried by hue alone.
 */
export function ChartLegend({
  items,
  className,
}: Readonly<{ items: { label: string; color: string; value?: React.ReactNode }[]; className?: string }>) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span aria-hidden className="h-[3px] w-3.5 rounded-full" style={{ background: item.color }} />
          <span className="text-[11px] text-[var(--text-3)]">{item.label}</span>
          {item.value !== undefined ? (
            <span className="t-num text-[11px] font-semibold text-[var(--text)]">{item.value}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * Direct-labelled readout beside a donut or stacked bar. Segment identity is
 * always duplicated in text — a grey "no data" slice next to a red "tamper"
 * slice is not separable by hue alone under protanopia.
 */
export function SeriesReadout({
  items,
  total,
  className,
}: Readonly<{
  items: { label: string; value: number; color: string }[];
  total: number;
  className?: string;
}>) {
  return (
    <ul className={cn("divide-y divide-[var(--line-soft)]", className)}>
      {items.map((item) => {
        const share = total > 0 ? (item.value / total) * 100 : 0;
        return (
          <li key={item.label} className="flex items-center gap-2.5 py-1.5">
            <span aria-hidden className="h-2 w-2 flex-none rounded-[2px]" style={{ background: item.color }} />
            <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--text-2)]">{item.label}</span>
            <span className="t-num text-[12px] font-semibold text-[var(--text)]">
              {item.value.toLocaleString("en-IN")}
            </span>
            <span className="t-num w-11 text-right text-[11px] text-[var(--text-4)]">{share.toFixed(1)}%</span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Consistent framing for a plot. Charts do not each invent their own container
 * — they sit in the same panel language as every table.
 */
export function ChartFrame({
  title,
  caption,
  aside,
  height = 200,
  children,
  footer,
  className,
}: Readonly<{
  title: string;
  caption?: string;
  aside?: React.ReactNode;
  height?: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}>) {
  return (
    <div className={cn("panel-flush flex min-w-0 flex-col", className)}>
      <div className="panel-head shrink-0">
        <div className="min-w-0">
          <h3 className="t-panel-title truncate">{title}</h3>
          {caption ? <p className="t-meta mt-0.5 truncate text-[var(--text-4)]">{caption}</p> : null}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
      {/* Fixed height, never flex-1: inside a content-sized column the flex
          basis resolves to 0 and the plot collapses to nothing. */}
      <div style={{ height }} className="min-w-0 shrink-0 px-2 pb-1 pt-3">
        {children}
      </div>
      {footer ? <div className="shrink-0 border-t border-[var(--line-soft)] px-3.5 py-2.5">{footer}</div> : null}
    </div>
  );
}

/**
 * Inline sparkline. For trend context inside a metric cell or a table row,
 * where a full plot would be more chrome than signal.
 */
export function Sparkline({
  values,
  color = chartColors.primary,
  width = 72,
  height = 20,
  className,
}: Readonly<{ values: number[]; color?: string; width?: number; height?: number; className?: string }>) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const points = values.map((value, index) => `${index * step},${height - ((value - min) / span) * (height - 2) - 1}`);

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn("overflow-visible", className)}
      preserveAspectRatio="none"
    >
      <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={points[points.length - 1].split(",")[0]} cy={points[points.length - 1].split(",")[1]} r={1.8} fill={color} />
    </svg>
  );
}

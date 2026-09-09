"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: string;
  /** `num` right-aligns with tabular figures; `mono` for identifiers. */
  variant?: "text" | "num" | "mono";
  width?: string;
  /** Hide below the given breakpoint so narrow viewports stay readable. */
  hideBelow?: "sm" | "md" | "lg" | "xl" | "2xl";
  /** Return a comparable value to make the column sortable. */
  sortBy?: (row: T) => string | number;
  render: (row: T) => React.ReactNode;
};

const hideClass = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
  "2xl": "hidden 2xl:table-cell",
} as const;

/**
 * The product's table.
 *
 * Real `<table>` semantics throughout — rows stay rows, so keyboard traversal,
 * screen readers, column alignment and copy-paste into a report all behave the
 * way an officer expects. Sorting is client-side and optional per column;
 * the header stays stuck to the top of its own scroll container so a long
 * register never loses its column identities.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  selectedKey,
  severityOf,
  caption,
  density = "compact",
  maxHeight,
  emptyState,
  defaultSort,
  className,
}: Readonly<{
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectedKey?: string | null;
  /** Draws a severity edge on the row. For registers that carry incidents. */
  severityOf?: (row: T) => "crit" | "warn" | "tamper" | undefined;
  caption: string;
  density?: "compact" | "relaxed";
  maxHeight?: string;
  emptyState?: React.ReactNode;
  defaultSort?: { key: string; direction: "asc" | "desc" };
  className?: string;
}>) {
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" } | null>(defaultSort ?? null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((item) => item.key === sort.key);
    if (!column?.sortBy) return rows;
    const factor = sort.direction === "asc" ? 1 : -1;
    // Copy first: sorting the prop array in place would mutate store state.
    return [...rows].sort((a, b) => {
      const left = column.sortBy!(a);
      const right = column.sortBy!(b);
      if (typeof left === "number" && typeof right === "number") return (left - right) * factor;
      return String(left).localeCompare(String(right)) * factor;
    });
  }, [rows, sort, columns]);

  const toggleSort = (key: string) =>
    setSort((current) =>
      current?.key === key
        ? current.direction === "asc"
          ? { key, direction: "desc" }
          : null
        : { key, direction: "asc" },
    );

  if (rows.length === 0 && emptyState) return <>{emptyState}</>;

  return (
    <div
      className={cn("scroll-x min-h-0", maxHeight ? "overflow-y-auto" : undefined, className)}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <table className="grid-table" data-density={density}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => {
              const sortable = Boolean(column.sortBy);
              const active = sort?.key === column.key;
              return (
                <th
                  key={column.key}
                  scope="col"
                  data-sortable={sortable || undefined}
                  aria-sort={active ? (sort!.direction === "asc" ? "ascending" : "descending") : undefined}
                  style={column.width ? { width: column.width } : undefined}
                  onClick={sortable ? () => toggleSort(column.key) : undefined}
                  className={cn(
                    column.variant === "num" && "text-right",
                    column.hideBelow && hideClass[column.hideBelow],
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex items-center gap-1",
                      column.variant === "num" && "flex-row-reverse",
                      active && "text-[var(--text-2)]",
                    )}
                  >
                    {column.header}
                    {sortable ? (
                      active ? (
                        sort!.direction === "asc" ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 opacity-30" />
                      )
                    ) : null}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const key = rowKey(row);
            const clickable = Boolean(onRowClick);
            const selected = selectedKey === key;
            return (
              <tr
                key={key}
                data-interactive={clickable || undefined}
                data-selected={selected || undefined}
                // Selection takes the left edge when both apply, so the row an
                // operator has open is never mistaken for one they have not.
                data-severity={!selected ? severityOf?.(row) : undefined}
                tabIndex={clickable ? 0 : undefined}
                aria-selected={clickable ? selected : undefined}
                onClick={clickable ? () => onRowClick?.(row) : undefined}
                onKeyDown={
                  clickable
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onRowClick?.(row);
                        }
                      }
                    : undefined
                }
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      column.variant === "num" && "t-num text-right font-medium text-[var(--text)]",
                      column.variant === "mono" && "t-mono text-[var(--text-3)]",
                      column.hideBelow && hideClass[column.hideBelow],
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Two-line identity cell. The primary line is the thing an operator would say
 * out loud — a registration number, a device ID, a centre name.
 */
export function IdentityCell({
  title,
  subtitle,
  mono = false,
  className,
}: Readonly<{ title: React.ReactNode; subtitle?: React.ReactNode; mono?: boolean; className?: string }>) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className={cn("truncate font-medium text-[var(--text)]", mono ? "t-mono" : "text-[12.5px]")}>{title}</p>
      {subtitle ? <p className="t-mono-sm mt-0.5 truncate text-[var(--text-4)]">{subtitle}</p> : null}
    </div>
  );
}

/** Registration plate cell — the fleet's primary human identifier. */
export function PlateCell({ value, className }: Readonly<{ value: string; className?: string }>) {
  return <span className={cn("t-reg", className)}>{value}</span>;
}

/** Retained alias so existing call sites keep working. */
export const PrimaryCell = IdentityCell;

/**
 * A speed reading against its limit. The excess is what matters, so it is
 * shown rather than left for the reader to subtract.
 */
export function SpeedCell({
  speed,
  limit,
  tolerance,
  className,
}: Readonly<{ speed: number; limit: number; tolerance?: number; className?: string }>) {
  const trigger = limit + (tolerance ?? 0);
  const over = speed > trigger;
  const near = !over && speed > limit;
  return (
    <span className={cn("inline-flex items-baseline justify-end gap-1.5", className)}>
      <span
        className={cn(
          "t-num text-[13px] font-semibold",
          over ? "text-[var(--crit-text)]" : near ? "text-[var(--warn-text)]" : "text-[var(--text)]",
        )}
      >
        {Math.round(speed)}
      </span>
      <span className="t-mono-sm text-[var(--text-4)]">/{limit}</span>
    </span>
  );
}

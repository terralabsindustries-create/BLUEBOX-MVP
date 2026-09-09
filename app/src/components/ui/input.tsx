"use client";

import { useId } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: Readonly<React.InputHTMLAttributes<HTMLInputElement>>) {
  return <input className={cn("field", className)} {...props} />;
}

export function Select({ className, children, ...props }: Readonly<React.SelectHTMLAttributes<HTMLSelectElement>>) {
  return (
    <select className={cn("field", className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: Readonly<React.TextareaHTMLAttributes<HTMLTextAreaElement>>) {
  return <textarea className={cn("field", className)} {...props} />;
}

/**
 * Search control with an affordance to clear. Used by the registry lookup, the
 * fleet filter bar and the audit trail — the clear button matters because an
 * operator who cannot see why a table is empty distrusts the table.
 */
export function SearchField({
  value,
  onChange,
  placeholder,
  size = "md",
  className,
  id,
  ...props
}: Readonly<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  size?: "md" | "lg";
  className?: string;
  id?: string;
}> &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "size">) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <Search
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-4)]",
          size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5",
        )}
      />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(
          "field pl-8 pr-8",
          // The native clear affordance is replaced by our own so it is
          // keyboard reachable and consistent across browsers.
          "[&::-webkit-search-cancel-button]:appearance-none",
          size === "lg" && "h-9 pl-9 text-[13.5px]",
        )}
        {...props}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-1.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-[var(--r-xs)] text-[var(--text-4)] transition-colors hover:bg-[var(--panel-raised)] hover:text-[var(--text)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

/** Label + control + hint, wired together for assistive technology. */
export function LabelledField({
  label,
  hint,
  error,
  required,
  className,
  children,
}: Readonly<{
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => React.ReactNode;
}>) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className="t-label mb-1.5 block">
        {label}
        {required ? <span className="ml-1 text-[var(--crit)]">*</span> : null}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-[11px] text-[var(--crit-text)]">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-[11px] leading-snug text-[var(--text-4)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A configuration row: label, description, and its control on the right.
 * The layout used throughout System Settings.
 */
export function SettingRow({
  label,
  description,
  control,
  danger = false,
  className,
}: Readonly<{
  label: string;
  description?: string;
  control: React.ReactNode;
  danger?: boolean;
  className?: string;
}>) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-x-6 gap-y-2 border-b border-[var(--line-soft)] px-3.5 py-3 last:border-b-0",
        danger && "bg-[var(--crit-dim)]",
        className,
      )}
    >
      <div className="min-w-0 max-w-md">
        <p className={cn("text-[12.5px] font-medium", danger ? "text-[var(--crit-text)]" : "text-[var(--text)]")}>
          {label}
        </p>
        {description ? <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--text-3)]">{description}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">{control}</div>
    </div>
  );
}

/**
 * Read-only configuration value. Most settings in the MVP are fixed by the
 * deployment, and showing them as editable inputs would misrepresent the
 * system — so they render as locked values instead.
 */
export function ReadOnlyValue({ value, mono = true }: Readonly<{ value: string; mono?: boolean }>) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-[var(--r-sm)] border border-[var(--line)] bg-[var(--panel-sunken)] px-2.5 text-[var(--text-2)]",
        mono ? "t-mono" : "text-[12px]",
      )}
    >
      {value}
    </span>
  );
}

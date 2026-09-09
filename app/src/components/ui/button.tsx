import * as React from "react";
import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Controls for operational software: rectangular, compact, no lift, no glow.
 * The only saturated button is `primary`, and a screen should rarely have more
 * than one.
 */
const buttonVariants = cva(
  [
    "relative inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap",
    "font-medium rounded-[var(--r-sm)] border",
    "transition-[background-color,border-color,color] duration-[var(--t-fast)] ease-[var(--ease)]",
    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--brand)]",
    "disabled:pointer-events-none disabled:opacity-45",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-on)] font-semibold hover:bg-[var(--brand-hover)] hover:border-[var(--brand-hover)] active:bg-[var(--brand-press)]",
        secondary:
          "border-[var(--line)] bg-[var(--panel-inset)] text-[var(--text-2)] hover:bg-[var(--panel-raised)] hover:text-[var(--text)] hover:border-[var(--line-strong)]",
        subtle:
          "border-transparent bg-[var(--panel-sunken)] text-[var(--text-3)] hover:bg-[var(--panel-raised)] hover:text-[var(--text)]",
        ghost: "border-transparent bg-transparent text-[var(--text-3)] hover:bg-[var(--panel-raised)] hover:text-[var(--text)]",
        /** Destructive or state-degrading actions in the presenter console. */
        danger:
          "border-[var(--crit-line)] bg-[var(--crit-dim)] text-[var(--crit-text)] hover:border-[var(--crit)] hover:bg-[rgba(244,54,76,0.22)]",
        /** Selected state for toggle groups. */
        selected: "border-[var(--brand-line)] bg-[var(--brand-dim)] text-[var(--brand-text)] hover:bg-[rgba(255,93,58,0.2)]",
        /** For controls sitting on the dark command chrome. */
        command:
          "border-transparent bg-transparent text-[var(--text-3)] hover:bg-[var(--chrome-hover)] hover:text-[var(--text)]",
        commandActive: "border-[var(--brand-line)] bg-[var(--brand-dim)] text-[var(--brand-text)]",
      },
      size: {
        xs: "h-6 px-2 text-[11px]",
        sm: "h-7 px-2.5 text-[12px]",
        md: "h-8 px-3 text-[12.5px]",
        lg: "h-9 px-4 text-[13px]",
        icon: "h-8 w-8 p-0",
        "icon-sm": "h-7 w-7 p-0",
        "icon-xs": "h-6 w-6 p-0",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };

/**
 * Navigational twin of `Button`. A real anchor, so middle-click, "open in new
 * tab" and screen-reader semantics all keep working.
 */
export function LinkButton({
  className,
  variant,
  size,
  href,
  children,
  ...props
}: Readonly<{ href: string; children: React.ReactNode }> &
  VariantProps<typeof buttonVariants> &
  Omit<React.ComponentProps<typeof Link>, "href" | "children">) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {children}
    </Link>
  );
}

/**
 * Segmented control. The standard filter affordance across the product — one
 * row of mutually exclusive states, always showing which is active.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: Readonly<{
  options: readonly { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}>) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn("segment", className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count !== undefined ? (
            <span
              className={cn(
                "t-num text-[10.5px] font-semibold",
                value === option.value ? "text-[var(--brand-text)]" : "text-[var(--text-4)]",
              )}
            >
              {option.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

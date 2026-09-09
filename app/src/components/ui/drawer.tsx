"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * The one floating-surface language: an inspection drawer from the right, or a
 * centred dialog. Both share a scrim, a focus trap, focus restore and the same
 * dismissal contract (Escape, scrim, explicit close).
 *
 * Rendered through a portal into `document.body` so it always clears the
 * sidebar and command bar, whatever stacking context the calling page is in.
 */
export function Overlay({
  open,
  onClose,
  title,
  eyebrow,
  description,
  children,
  footer,
  side = "right",
  width = "max-w-2xl",
  labelledBy,
  tone,
  className,
}: Readonly<{
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  eyebrow?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  side?: "right" | "center";
  width?: string;
  labelledBy?: string;
  tone?: "crit" | "warn";
  /** Applied to the overlay root, so a caller can hide the drawer at a
      breakpoint where the same content is already docked inline. */
  className?: string;
}>) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  const mounted = useHydrated();

  useEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement as HTMLElement | null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    const focusTimer = window.setTimeout(() => panelRef.current?.focus(), 20);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      restoreTo.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const headingId = labelledBy ?? "overlay-heading";

  return createPortal(
    <div className={cn("fixed inset-0 z-[var(--z-overlay)] flex", className)} role="presentation">
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="a-fade absolute inset-0 cursor-default bg-[rgba(3,5,7,0.66)] backdrop-blur-[2px]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        className={cn(
          "relative flex flex-col border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-float)] outline-none",
          side === "right"
            ? cn("a-slide-in ml-auto h-full w-full border-l", width)
            : cn("a-fade m-auto h-auto max-h-[88svh] rounded-[var(--r-lg)] border", width),
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-start justify-between gap-4 border-b border-[var(--line)] px-4 py-3",
            tone === "crit" && "bg-[var(--crit-dim)]",
            tone === "warn" && "bg-[var(--warn-dim)]",
          )}
        >
          <div className="min-w-0">
            {eyebrow ? <p className="t-label">{eyebrow}</p> : null}
            <h2 id={headingId} className="t-page-title mt-0.5 break-words">
              {title}
            </h2>
            {description ? <p className="t-meta mt-1 max-w-lg">{description}</p> : null}
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

        {footer ? (
          <div className="shrink-0 border-t border-[var(--line)] bg-[var(--panel-header)] px-4 py-2.5">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/**
 * An inline inspection panel — the same content as a drawer, but docked beside
 * the table on wide displays. Master-detail beats a modal when an operator is
 * comparing records, so the enforcement views use this above 1280px and fall
 * back to the drawer below it.
 */
export function DetailPane({
  title,
  eyebrow,
  onClose,
  tone,
  footer,
  children,
  className,
}: Readonly<{
  title: React.ReactNode;
  eyebrow?: string;
  onClose?: () => void;
  tone?: "crit" | "warn";
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}>) {
  return (
    <div className={cn("panel-flush flex min-h-0 flex-col", className)}>
      <div
        className={cn(
          "flex shrink-0 items-start justify-between gap-3 border-b border-[var(--line)] px-3.5 py-2.5",
          tone === "crit" && "bg-[var(--crit-dim)]",
          tone === "warn" && "bg-[var(--warn-dim)]",
          !tone && "bg-[var(--panel-header)]",
        )}
      >
        <div className="min-w-0">
          {eyebrow ? <p className="t-label">{eyebrow}</p> : null}
          <p className="mt-0.5 truncate text-[15px] font-semibold tracking-[-0.012em] text-[var(--text)]">{title}</p>
        </div>
        {onClose ? (
          <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label="Close detail">
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      {footer ? (
        <div className="shrink-0 border-t border-[var(--line)] bg-[var(--panel-header)] px-3.5 py-2">{footer}</div>
      ) : null}
    </div>
  );
}

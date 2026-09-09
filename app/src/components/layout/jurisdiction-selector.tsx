"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import { StatusBadge } from "@/components/ui/status";
import { JURISDICTIONS, jurisdictionLabel } from "@/lib/jurisdiction";
import { useJurisdiction } from "@/lib/use-jurisdiction";
import { useSimulationStore } from "@/store/simulation-store";
import { cn } from "@/lib/utils";

/**
 * The jurisdiction control.
 *
 * This is the surface that states, in the chrome of every screen, that BlueBox
 * One is infrastructure rather than software for one authority. Switching
 * jurisdiction re-points units, locale, timezone, currency, plate format and
 * the local term for a notice — without changing a single component.
 *
 * Unprovisioned deployments are listed and disabled rather than hidden. That is
 * the honest presentation: the platform supports them, this build carries data
 * for one, and a viewer can see exactly which.
 */
export function JurisdictionSelector() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const j = useJurisdiction();
  const setJurisdiction = useSimulationStore((state) => state.setJurisdiction);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Jurisdiction: ${j.label}. Change jurisdiction.`}
        className={cn(
          "flex h-7 max-w-[240px] items-center gap-2 rounded-[var(--r-sm)] border px-2 transition-colors duration-[var(--t-fast)]",
          open ? "border-[var(--line-strong)] bg-[var(--chrome-hover)]" : "border-transparent hover:bg-[var(--chrome-hover)]",
        )}
      >
        <Globe className="h-3.5 w-3.5 flex-none text-[var(--text-4)]" strokeWidth={1.8} />
        <span className="min-w-0 text-left leading-none">
          <span className="block truncate text-[11.5px] font-medium text-[var(--text)]">{j.label}</span>
          <span className="mt-[3px] block truncate text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--warn-text)]">
            {j.environment} jurisdiction
          </span>
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "h-3 w-3 flex-none text-[var(--text-4)] transition-transform duration-[var(--t-fast)]",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Jurisdiction"
          className="a-fade absolute left-0 top-[calc(100%+6px)] z-[var(--z-topbar)] w-[336px] rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--panel-raised)] shadow-[var(--shadow-float)]"
        >
          <div className="border-b border-[var(--line)] px-3 py-2.5">
            <p className="t-panel-title">Deployment Jurisdiction</p>
            <p className="t-meta mt-1 leading-snug">
              Sets units, locale, timezone, currency, registration format and enforcement notice terminology.
            </p>
          </div>

          <ul className="max-h-[300px] overflow-y-auto py-1">
            {JURISDICTIONS.map((item) => {
              const active = item.id === j.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    disabled={!item.provisioned}
                    onClick={() => {
                      setJurisdiction(item.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors duration-[var(--t-fast)]",
                      item.provisioned ? "hover:bg-[var(--panel-header)]" : "cursor-not-allowed opacity-45",
                      active && "bg-[var(--brand-dim)]",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "t-mono-sm grid h-6 w-8 flex-none place-items-center rounded-[var(--r-xs)] border font-semibold",
                        active
                          ? "border-[var(--brand-line)] bg-[var(--brand-dim)] text-[var(--brand-text)]"
                          : "border-[var(--line)] bg-[var(--panel-sunken)] text-[var(--text-3)]",
                      )}
                    >
                      {item.countryCode}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-[var(--text)]">
                        {jurisdictionLabel(item)}
                      </span>
                      <span className="block truncate text-[10.5px] text-[var(--text-4)]">
                        {item.authorityName} · {item.speedUnit} · {item.timezoneLabel}
                      </span>
                    </span>
                    {active ? (
                      <Check className="h-3.5 w-3.5 flex-none text-[var(--brand)]" strokeWidth={2.5} />
                    ) : !item.provisioned ? (
                      <StatusBadge tone="idle">No data</StatusBadge>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="border-t border-[var(--line)] px-3 py-2 text-[10.5px] leading-snug text-[var(--text-4)]">
            Telemetry, the speed rule and stored evidence remain in km/h — the device&rsquo;s native unit. Imperial
            jurisdictions convert at display only.
          </p>
        </div>
      ) : null}
    </div>
  );
}

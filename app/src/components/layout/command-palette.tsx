"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { CornerDownLeft, Search } from "lucide-react";
import { navItems } from "@/components/layout/nav-config";
import { StatusBadge } from "@/components/ui/status";
import { useSimulationStore } from "@/store/simulation-store";
import { useHydrated } from "@/lib/use-hydrated";
import { useJurisdiction } from "@/lib/use-jurisdiction";
import { normalisePlate } from "@/lib/jurisdiction";
import { enforcementLabel, enforcementTone } from "@/lib/status";
import { cn, enforcementStateOf } from "@/lib/utils";

type Entry = {
  id: string;
  kind: "Navigate" | "Vehicle" | "Device" | "Violation";
  title: string;
  subtitle: string;
  href: string;
  onSelect?: () => void;
  trailing?: React.ReactNode;
};

/**
 * Global command palette.
 *
 * An operator recalls a registration plate or a device ID — not which of
 * thirteen screens that record lives on. This searches entities first and
 * destinations second, and it is the reason the top bar carries a search
 * affordance rather than a per-page search box.
 *
 * Plate matching is normalised on both sides, so `KL07AB1289`, `kl 07 ab 1289`
 * and `07ab` all reach the same vehicle.
 */
export function CommandPalette() {
  const mounted = useHydrated();
  const open = useSimulationStore((state) => state.commandOpen);
  const setOpen = useSimulationStore((state) => state.setCommandOpen);

  // ⌘K / Ctrl-K anywhere, and "/" when the operator is not already typing.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.matches("input, textarea, select, [contenteditable='true']");
      if ((event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen(!open);
        return;
      }
      if (event.key === "/" && !typing && !open) {
        event.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open || !mounted) return null;
  return <PaletteDialog onClose={() => setOpen(false)} />;
}

/**
 * Mounted only while the palette is open, so its query and cursor begin empty
 * by construction rather than being reset in an effect on every open.
 */
function PaletteDialog({ onClose }: Readonly<{ onClose: () => void }>) {
  const router = useRouter();
  const j = useJurisdiction();
  const vehicles = useSimulationStore((state) => state.vehicles);
  const violations = useSimulationStore((state) => state.violations);
  const selectVehicle = useSimulationStore((state) => state.selectVehicle);
  const selectViolation = useSimulationStore((state) => state.selectViolation);

  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const entries = useMemo<Entry[]>(() => {
    const raw = query.trim();
    const term = raw.toLowerCase();
    const plate = normalisePlate(raw);

    const destinations: Entry[] = navItems
      .filter((item) => !term || item.label.toLowerCase().includes(term))
      .map((item) => ({
        id: `nav-${item.href}`,
        kind: "Navigate",
        title: item.label,
        subtitle: item.href,
        href: item.href,
      }));

    if (!raw) return destinations;

    const vehicleHits: Entry[] = vehicles
      .filter(
        (vehicle) =>
          normalisePlate(vehicle.registrationNumber).includes(plate) ||
          vehicle.device.id.toLowerCase().includes(term) ||
          vehicle.ownerName.toLowerCase().includes(term) ||
          vehicle.chassisReference.toLowerCase().includes(term),
      )
      .slice(0, 6)
      .map((vehicle) => {
        const state = enforcementStateOf(vehicle);
        return {
          id: `vehicle-${vehicle.id}`,
          kind: "Vehicle",
          title: vehicle.registrationNumber,
          subtitle: `${vehicle.ownerName} · ${vehicle.device.id} · ${j.speed(vehicle.telemetry.speed)}`,
          href: "/live-vehicles",
          onSelect: () => selectVehicle(vehicle.id),
          trailing: <StatusBadge tone={enforcementTone[state]}>{enforcementLabel[state]}</StatusBadge>,
        };
      });

    const violationHits: Entry[] = violations
      .filter(
        (violation) =>
          violation.id.toLowerCase().includes(term) ||
          normalisePlate(violation.registrationNumber).includes(plate),
      )
      .slice(0, 4)
      .map((violation) => ({
        id: `violation-${violation.id}`,
        kind: "Violation",
        title: violation.id,
        subtitle: `${violation.registrationNumber} · ${j.speed(violation.gpsSpeed)} · ${violation.roadName}`,
        href: "/violations",
        onSelect: () => selectViolation(violation.id),
        trailing: <StatusBadge>{violation.level}</StatusBadge>,
      }));

    return [...vehicleHits, ...violationHits, ...destinations];
  }, [query, vehicles, violations, j, selectVehicle, selectViolation]);

  // A shrinking result list must never leave the cursor past the end. Clamped
  // during render rather than corrected in an effect, so the highlighted row is
  // always valid for the list currently on screen.
  const active = Math.min(cursor, Math.max(0, entries.length - 1));

  const run = (entry: Entry) => {
    entry.onSelect?.();
    router.push(entry.href);
    onClose();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((current) => Math.min(current + 1, entries.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter" && entries[active]) {
      event.preventDefault();
      run(entries[active]);
    }
  };

  // Keep the highlighted row inside the scroll viewport during keyboard travel.
  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return createPortal(
    <div className="fixed inset-0 z-[var(--z-overlay)] flex items-start justify-center p-4 pt-[12vh]" role="presentation">
      <button
        type="button"
        aria-label="Close search"
        onClick={onClose}
        className="a-fade absolute inset-0 cursor-default bg-[rgba(3,5,7,0.66)] backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        onKeyDown={onKeyDown}
        className="a-rise relative flex max-h-[68vh] w-full max-w-[560px] flex-col overflow-hidden rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--panel-raised)] shadow-[var(--shadow-float)]"
      >
        <div className="flex shrink-0 items-center gap-2.5 border-b border-[var(--line)] px-3.5">
          <Search className="h-4 w-4 flex-none text-[var(--text-4)]" strokeWidth={1.8} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCursor(0);
            }}
            placeholder={`Search registration, device, violation or screen — e.g. ${j.registrationExample}`}
            aria-label="Search"
            className="h-11 min-w-0 flex-1 bg-transparent text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--text-4)]"
          />
          <kbd className="t-mono-sm flex-none rounded-[3px] border border-[var(--line)] px-1 py-px text-[9.5px] text-[var(--text-4)]">
            ESC
          </kbd>
        </div>

        {entries.length === 0 ? (
          <p className="px-4 py-8 text-center text-[12px] text-[var(--text-4)]">
            Nothing matches “{query}”.
          </p>
        ) : (
          <ul ref={listRef} className="min-h-0 flex-1 overflow-y-auto py-1">
            {entries.map((entry, index) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => run(entry)}
                  onMouseEnter={() => setCursor(index)}
                  aria-current={index === active}
                  className={cn(
                    "flex w-full items-center gap-3 px-3.5 py-2 text-left transition-colors duration-[var(--t-fast)]",
                    index === active ? "bg-[var(--brand-dim)]" : "hover:bg-[var(--panel-header)]",
                  )}
                >
                  <span
                    className={cn(
                      "w-[62px] flex-none text-[9px] font-bold uppercase tracking-[0.1em]",
                      index === active ? "text-[var(--brand-text)]" : "text-[var(--text-4)]",
                    )}
                  >
                    {entry.kind}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate font-medium text-[var(--text)]",
                        entry.kind === "Navigate" ? "text-[12.5px]" : "t-mono text-[12px]",
                      )}
                    >
                      {entry.title}
                    </span>
                    <span className="block truncate text-[10.5px] text-[var(--text-4)]">{entry.subtitle}</span>
                  </span>
                  {entry.trailing ? <span className="flex-none">{entry.trailing}</span> : null}
                  {index === active ? (
                    <CornerDownLeft aria-hidden className="h-3.5 w-3.5 flex-none text-[var(--brand)]" />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex shrink-0 items-center gap-4 border-t border-[var(--line)] px-3.5 py-2 text-[10px] text-[var(--text-4)]">
          <span>↑↓ Navigate</span>
          <span>↵ Open</span>
          <span className="ml-auto">
            {entries.length} result{entries.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

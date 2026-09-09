"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { TerraMark } from "@/components/layout/brand-mark";
import { PRODUCT } from "@/components/layout/nav-config";
import { useSimulationStore } from "@/store/simulation-store";
import { useHydrated } from "@/lib/use-hydrated";
import { useJurisdiction } from "@/lib/use-jurisdiction";
import { cn } from "@/lib/utils";

/**
 * Startup sequence for the portable bundle.
 *
 * When an officer double-clicks `Start BlueBox.cmd`, a browser opens on a
 * half-hydrated dashboard. This covers that moment with something that reads as
 * commissioned infrastructure coming up.
 *
 * Every line reports a condition the application can genuinely determine — the
 * store rehydrating, the WebSocket bridge answering, the rule engine loading
 * its configuration. Nothing here is a timed fiction: if the bridge is not
 * running, the bridge line says so and stays amber, which is the correct thing
 * to tell an operator before they start a demonstration.
 *
 * Shown once per browser session, so navigating between routes never replays it.
 */

const SESSION_KEY = "bluebox-one-booted";

type CheckState = "pending" | "ready" | "degraded";

/**
 * Whether this browser session has already seen the startup sequence.
 *
 * Read through `useSyncExternalStore` because sessionStorage *is* an external
 * store: the server cannot see it, and reading it in an effect that then calls
 * setState is exactly the cascading-render pattern React 19 warns about.
 * Access is wrapped because some privacy contexts throw on the property itself,
 * and a boot screen is never worth breaking the application over.
 */
const bootStore = {
  subscribe() {
    // The value only ever changes from inside this component, so there is
    // nothing external to subscribe to.
    return () => {};
  },
  getSnapshot() {
    try {
      return sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      return true;
    }
  },
  // On the server there is no session, and rendering the sequence into the HTML
  // would flash it on every navigation. Treat it as already seen.
  getServerSnapshot() {
    return true;
  },
};

export function BootScreen() {
  const mounted = useHydrated();
  const hydrated = useSimulationStore((state) => state.hydrated);
  const bridgeLink = useSimulationStore((state) => state.dashboardBridgeLink);
  const vehicles = useSimulationStore((state) => state.vehicles);
  const j = useJurisdiction();

  const alreadySeen = useSyncExternalStore(
    bootStore.subscribe,
    bootStore.getSnapshot,
    bootStore.getServerSnapshot,
  );
  const [dismissed, setDismissed] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const visible = !alreadySeen && !dismissed;

  useEffect(() => {
    if (!visible) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 100), 100);
    return () => window.clearInterval(timer);
  }, [visible]);

  const checks: { label: string; state: CheckState; detail: string }[] = [
    {
      label: "Dashboard",
      state: mounted ? "ready" : "pending",
      detail: mounted ? "Interface mounted" : "Mounting",
    },
    {
      label: "Evidence Engine",
      state: hydrated && vehicles.length > 0 ? "ready" : "pending",
      detail: hydrated && vehicles.length > 0 ? `${vehicles.length} devices restored` : "Restoring local state",
    },
    {
      label: "Device Bridge",
      // After ~2.5s with no socket, the bridge is genuinely not there. Saying
      // "degraded" is more useful than spinning forever on a hopeful "pending".
      state: bridgeLink === "connected" ? "ready" : elapsed > 2500 ? "degraded" : "pending",
      detail:
        bridgeLink === "connected"
          ? "ws://localhost:8765"
          : elapsed > 2500
            ? "Not running — dashboard simulation only"
            : "Connecting",
    },
  ];

  const settled = checks.every((check) => check.state !== "pending");

  const dismiss = useCallback(() => {
    setDismissing(true);
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* Non-fatal: the sequence simply shows again on the next load. */
    }
    window.setTimeout(() => setDismissed(true), 240);
  }, []);

  // Enter or Escape dismisses, but only once the checks have settled — there is
  // nothing useful to skip to before then.
  useEffect(() => {
    if (!visible || !settled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible, settled, dismiss]);

  if (!visible || !mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-label="BlueBox One startup"
      className={cn(
        "fixed inset-0 z-[var(--z-boot)] flex flex-col items-center justify-center bg-[var(--chrome)] px-6",
        dismissing ? "pointer-events-none opacity-0 transition-opacity duration-[var(--t-slow)]" : "a-fade",
      )}
    >
      <div className="flex w-full max-w-[380px] flex-col items-center">
        <TerraMark className="h-[52px] w-[52px]" />

        <h1 className="mt-6 text-center text-[26px] font-semibold leading-none tracking-[-0.03em] text-[var(--text)]">
          {PRODUCT.name}
        </h1>
        <p className="mt-3 text-center text-[9.5px] font-semibold uppercase tracking-[0.22em] text-[var(--text-4)]">
          {PRODUCT.shortPositioning}
        </p>

        <div aria-hidden className="my-7 h-px w-full bg-[var(--line)]" />

        <ul className="w-full space-y-2" aria-live="polite">
          {checks.map((check) => (
            <li key={check.label} className="flex items-baseline gap-2">
              <span className="text-[11.5px] text-[var(--text-2)]">{check.label}</span>
              <span
                aria-hidden
                className="min-w-0 flex-1 translate-y-[-3px] border-b border-dotted border-[var(--line-strong)]"
              />
              <span
                className={cn(
                  "t-mono-sm font-semibold uppercase tracking-[0.06em]",
                  check.state === "ready" && "text-[var(--ok-text)]",
                  check.state === "degraded" && "text-[var(--warn-text)]",
                  check.state === "pending" && "text-[var(--text-4)]",
                )}
              >
                {check.state === "ready" ? "Ready" : check.state === "degraded" ? "Unavailable" : "…"}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-3 h-4 w-full text-center text-[10.5px] text-[var(--text-4)]">
          {checks.find((check) => check.state === "pending")?.detail ??
            checks.find((check) => check.state === "degraded")?.detail ??
            "All subsystems nominal"}
        </p>

        {settled ? (
          <button
            type="button"
            onClick={dismiss}
            autoFocus
            className="a-fade mt-6 h-9 w-full rounded-[var(--r-sm)] border border-[var(--brand)] bg-[var(--brand)] text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-on)] transition-colors hover:bg-[var(--brand-hover)]"
          >
            Enter System
          </button>
        ) : (
          <div className="mt-6 w-full">
            <span className="progress-indeterminate block" />
          </div>
        )}

        <p className="mt-6 text-center text-[10px] text-[var(--text-4)]">
          {j.label} · <span className="text-[var(--warn-text)]">{j.environment} jurisdiction</span>
        </p>
      </div>

      <p className="absolute bottom-6 text-[9px] font-semibold uppercase tracking-[0.24em] text-[var(--text-4)]">
        {PRODUCT.vendor}
      </p>
    </div>,
    document.body,
  );
}

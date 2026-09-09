"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, Menu, MonitorPlay, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Overlay } from "@/components/ui/drawer";
import { StatusBadge, StatusDot } from "@/components/ui/status";
import { EmptyState } from "@/components/ui/states";
import { BridgeStatusControl } from "@/components/layout/bridge-status";
import { JurisdictionSelector } from "@/components/layout/jurisdiction-selector";
import { BrandLockup } from "@/components/layout/brand-mark";
import { useJurisdiction } from "@/lib/use-jurisdiction";
import { useSimulationStore } from "@/store/simulation-store";
import { toneOf } from "@/lib/status";
import { cn } from "@/lib/utils";

/**
 * The top bar.
 *
 * It exists to answer four questions continuously, so an operator never has to
 * navigate to find out:
 *
 *   Which jurisdiction am I controlling?  → JurisdictionSelector
 *   Is the system healthy?                → device count + BridgeStatusControl
 *   Is the data live?                     → clock with its zone, live indicator
 *   Is this real, or a demonstration?     → the DEMO control, always visible
 *
 * Everything else — page identity, filters, actions — belongs to the page.
 */
export function TopBar({ mounted }: Readonly<{ mounted: boolean }>) {
  const j = useJurisdiction();
  const sidebarCollapsed = useSimulationStore((state) => state.sidebarCollapsed);
  const now = useSimulationStore((state) => state.now);
  const vehicles = useSimulationStore((state) => state.vehicles);
  const notifications = useSimulationStore((state) => state.notifications);
  const demoControlsOpen = useSimulationStore((state) => state.demoControlsOpen);
  const toggleDemoControls = useSimulationStore((state) => state.toggleDemoControls);
  const setMobileNavOpen = useSimulationStore((state) => state.setMobileNavOpen);
  const setCommandOpen = useSimulationStore((state) => state.setCommandOpen);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const online = vehicles.filter((vehicle) => vehicle.telemetry.networkState !== "offline").length;
  const unread = notifications.length;
  // The lockup collapses with the rail, so the identity block and the rail
  // beneath it never disagree about their width.
  const collapsedBrand = mounted && sidebarCollapsed;

  return (
    <>
      <header
        className="fixed inset-x-0 top-0 z-[var(--z-topbar)] flex items-center border-b border-[var(--line)] bg-[var(--chrome)]"
        style={{ height: "var(--topbar-h)" }}
      >
        {/* Identity block, width-matched to the rail below it so the whole left
            column of the interface reads as a single unit. */}
        <div className="flex h-full shrink-0 items-center gap-1.5 border-r border-[var(--line)] px-2.5 transition-[width] duration-[var(--t-slow)] ease-[var(--ease)] lg:w-[var(--sidebar-offset)]">
          <Button
            variant="command"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <Link
            href="/dashboard"
            aria-label="BlueBox One — Overview"
            className="min-w-0 rounded-[var(--r-sm)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
          >
            <BrandLockup collapsed={collapsedBrand} />
          </Link>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2 px-2">
          <JurisdictionSelector />

          <span aria-hidden className="hidden h-4 w-px bg-[var(--line)] sm:block" />

          {/* Global search opens a command palette rather than filtering in
              place: an operator recalls a plate, not which of thirteen screens
              that record lives on. */}
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className={cn(
              "hidden h-7 min-w-[190px] max-w-[300px] flex-1 items-center gap-2 rounded-[var(--r-sm)] border border-[var(--line)]",
              "bg-[var(--chrome-raised)] px-2 text-left transition-colors duration-[var(--t-fast)]",
              "hover:border-[var(--line-strong)] hover:bg-[var(--chrome-hover)] md:flex",
            )}
          >
            <Search className="h-3.5 w-3.5 flex-none text-[var(--text-4)]" strokeWidth={1.8} />
            <span className="min-w-0 flex-1 truncate text-[11.5px] text-[var(--text-4)]">
              Search vehicles, devices, violations…
            </span>
            <kbd className="t-mono-sm flex-none rounded-[3px] border border-[var(--line)] bg-[var(--chrome)] px-1 py-px text-[9.5px] text-[var(--text-4)]">
              ⌘K
            </kbd>
          </button>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {/* The most-asked question in a control room, so it lives in the
                chrome rather than on one page. */}
            <span className="hidden items-center gap-1.5 px-1 xl:flex">
              <StatusDot tone="ok" live />
              <span className="t-num text-[11.5px] font-semibold text-[var(--text)]">{mounted ? online : "—"}</span>
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.09em] text-[var(--text-4)]">
                Devices online
              </span>
            </span>

            <span aria-hidden className="hidden h-4 w-px bg-[var(--line)] xl:block" />

            <BridgeStatusControl />

            <span aria-hidden className="hidden h-4 w-px bg-[var(--line)] sm:block" />

            {/* Always paired with its zone label: a bare clock in a control room
                spanning multiple jurisdictions is ambiguous, therefore useless. */}
            <time
              dateTime={now}
              suppressHydrationWarning
              className="t-mono hidden whitespace-nowrap px-1 text-[var(--text-2)] sm:block"
            >
              {mounted ? j.time(now) : "--:--:--"}
              <span className="ml-1 text-[9.5px] text-[var(--text-4)]">{j.timezoneLabel}</span>
            </time>

            <Button
              variant={demoControlsOpen ? "commandActive" : "command"}
              size="sm"
              onClick={toggleDemoControls}
              aria-pressed={demoControlsOpen}
              className="gap-1.5"
            >
              <MonitorPlay className="h-3.5 w-3.5" />
              <span className="text-[9.5px] font-bold uppercase tracking-[0.1em]">Demo</span>
            </Button>

            <Button
              variant="command"
              size="icon-sm"
              className="relative"
              onClick={() => setNotificationsOpen(true)}
              aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
            >
              <Bell className="h-4 w-4" />
              {mounted && unread > 0 ? (
                <span aria-hidden className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
              ) : null}
            </Button>

            <span
              aria-hidden
              className="ml-1 hidden h-6 w-6 place-items-center rounded-full bg-[var(--surface-3)] text-[9.5px] font-bold text-[var(--text-2)] sm:grid"
              title="Operator"
            >
              AN
            </span>
          </div>
        </div>
      </header>

      <Overlay
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        eyebrow="System"
        title="Notifications"
        description="Alerts raised by the enforcement engine during this session."
        width="max-w-md"
      >
        {notifications.length === 0 ? (
          <EmptyState
            icon={<Bell className="h-4 w-4" />}
            title="No alerts this session"
            description="Operational and critical alerts raised by the engine will appear here."
          />
        ) : (
          <ul className="divide-y divide-[var(--line-soft)]">
            {notifications.map((item) => (
              <li key={item.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[12.5px] font-semibold text-[var(--text)]">{item.title}</p>
                  <StatusBadge tone={toneOf(item.severity)}>{item.severity}</StatusBadge>
                </div>
                <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--text-3)]">{item.description}</p>
              </li>
            ))}
          </ul>
        )}
      </Overlay>
    </>
  );
}

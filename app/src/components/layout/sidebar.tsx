"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { navGroups, type NavItem } from "@/components/layout/nav-config";
import { useSimulationStore } from "@/store/simulation-store";
import { cn } from "@/lib/utils";

/**
 * Primary navigation.
 *
 * A flush rail against the edge of the display, not a floating card: this is
 * chrome, and chrome should stay out of the way. The active route is marked by
 * a 2px orange edge and a weight change — brand marks *where you are*, which
 * is the one job orange has in this product.
 *
 * Counters are live store state rather than hardcoded strings, which makes the
 * rail itself an instrument: if three tamper events open during a demo, the
 * rail says three, in the tamper colour, without anyone navigating there.
 */
export function Sidebar({ mounted }: Readonly<{ mounted: boolean }>) {
  const pathname = usePathname();
  const collapsedPref = useSimulationStore((state) => state.sidebarCollapsed);
  const mobileNavOpen = useSimulationStore((state) => state.mobileNavOpen);
  const setSidebarCollapsed = useSimulationStore((state) => state.setSidebarCollapsed);
  const setMobileNavOpen = useSimulationStore((state) => state.setMobileNavOpen);

  const violations = useSimulationStore((state) => state.violations);
  const tamperEvents = useSimulationStore((state) => state.tamperEvents);
  const notices = useSimulationStore((state) => state.notices);
  const vehicles = useSimulationStore((state) => state.vehicles);

  // Persisted preferences apply only after hydration, so the first client
  // render matches the server exactly.
  const collapsed = mounted && collapsedPref;

  // Counts mean "unresolved work", not "total records" — a badge showing 100
  // violations that are all closed is noise an operator learns to ignore.
  const counters = {
    violations: violations.filter((item) => item.uploadStatus !== "UPLOADED").length,
    tamper: tamperEvents.filter((item) => item.status === "Open").length,
    offline: vehicles.filter((item) => item.telemetry.networkState === "offline").length,
    notices: notices.filter((item) => item.status === "Pending Verification").length,
  };

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileNavOpen, setMobileNavOpen]);

  return (
    <>
      <button
        type="button"
        aria-label="Close navigation"
        tabIndex={mobileNavOpen ? 0 : -1}
        onClick={() => setMobileNavOpen(false)}
        className={cn(
          "fixed inset-0 z-[var(--z-scrim)] cursor-default bg-[rgba(3,5,7,0.6)] transition-opacity duration-[var(--t-base)] lg:hidden",
          mobileNavOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        aria-label="Primary navigation"
        style={{ width: collapsed ? "var(--sidebar-w-collapsed)" : "var(--sidebar-w)" }}
        className={cn(
          "fixed bottom-0 left-0 top-[var(--topbar-h)] z-[var(--z-sidebar)] flex flex-col",
          "border-r border-[var(--line)] bg-[var(--chrome)]",
          "transition-[transform,width] duration-[var(--t-slow)] ease-[var(--ease)]",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Mobile-only dismiss. On desktop the rail has no header of its own:
            the brand lockup lives in the top bar's identity block. */}
        <div className="flex h-9 shrink-0 items-center justify-end px-2 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
            className="grid h-6 w-6 place-items-center rounded-[var(--r-xs)] text-[var(--text-3)] hover:bg-[var(--chrome-hover)] hover:text-[var(--text)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto py-1.5">
          {navGroups.map((group) => (
            <div key={group.id} className="mb-0.5 last:mb-0">
              {collapsed ? (
                <div aria-hidden className="mx-2.5 my-2 h-px bg-[var(--line-soft)]" />
              ) : (
                <p className="px-3 pb-1 pt-3 text-[9px] font-bold uppercase tracking-[0.13em] text-[var(--text-4)]">
                  {group.label}
                </p>
              )}
              <ul>
                {group.items.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    active={pathname === item.href}
                    collapsed={collapsed}
                    count={item.counter && mounted ? counters[item.counter] : 0}
                    onNavigate={() => setMobileNavOpen(false)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-[var(--line)] p-1.5">
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            className={cn(
              "hidden h-7 w-full items-center gap-2 rounded-[var(--r-sm)] px-2 text-[11.5px] font-medium",
              "text-[var(--text-4)] transition-colors hover:bg-[var(--chrome-hover)] hover:text-[var(--text-2)] lg:flex",
              collapsed && "justify-center px-0",
            )}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed ? <span>Collapse</span> : null}
          </button>
        </div>
      </aside>
    </>
  );
}

function NavLink({
  item,
  active,
  collapsed,
  count,
  onNavigate,
}: Readonly<{
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  count: number;
  onNavigate: () => void;
}>) {
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        title={collapsed ? item.label : undefined}
        onClick={onNavigate}
        className={cn(
          "relative flex h-[29px] items-center gap-2.5 pl-3 pr-2.5",
          "transition-colors duration-[var(--t-fast)] ease-[var(--ease)]",
          "outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--brand)]",
          collapsed && "justify-center px-0",
          active
            ? "bg-[var(--chrome-raised)] text-[var(--text)]"
            : "text-[var(--text-3)] hover:bg-[var(--chrome-hover)] hover:text-[var(--text-2)]",
        )}
      >
        {active ? <span aria-hidden className="absolute inset-y-0 left-0 w-[2px] bg-[var(--brand)]" /> : null}
        <item.icon
          className={cn("h-[15px] w-[15px] flex-none", active && "text-[var(--brand)]")}
          strokeWidth={active ? 2.1 : 1.7}
        />
        {!collapsed ? (
          <>
            <span className={cn("min-w-0 flex-1 truncate text-[12.5px]", active ? "font-semibold" : "font-normal")}>
              {item.label}
            </span>
            {count > 0 ? (
              <span
                className={cn(
                  "t-num rounded-[3px] px-1.5 py-px text-[10px] font-bold leading-[14px]",
                  // Only tamper — a security event — earns a saturated badge.
                  item.counter === "tamper"
                    ? "bg-[var(--tamper)] text-[var(--on-solid)]"
                    : "bg-[var(--surface-3)] text-[var(--text-2)]",
                )}
              >
                {count}
              </span>
            ) : null}
          </>
        ) : count > 0 ? (
          <span
            aria-hidden
            className={cn(
              "absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full",
              item.counter === "tamper" ? "bg-[var(--tamper)]" : "bg-[var(--brand)]",
            )}
          />
        ) : null}
        {collapsed ? <span className="sr-only">{item.label}</span> : null}
      </Link>
    </li>
  );
}

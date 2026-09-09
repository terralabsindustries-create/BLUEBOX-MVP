"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/layout/command-palette";
import { BootScreen } from "@/components/layout/boot-screen";
import { PresenterConsole } from "@/components/presenter/presenter-console";
import { SimulationEngine } from "@/components/providers/simulation-engine";
import { useHydrated } from "@/lib/use-hydrated";
import { useSimulationStore } from "@/store/simulation-store";
import { cn } from "@/lib/utils";

/**
 * The application shell.
 *
 * A fixed rail and a fixed top bar, with a single scroll region between them
 * that the page owns. That last part matters: pages here are operational
 * screens with their own internal scrolling (a table body, a detail pane, a
 * map), so the shell must not impose a document scroll that would fight them.
 *
 * Layout is driven by `--sidebar-offset`, set once here from the collapse
 * preference, so the top bar and the workspace can never disagree about how
 * wide the rail currently is.
 */
export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const collapsedPref = useSimulationStore((state) => state.sidebarCollapsed);
  const presentationMode = useSimulationStore((state) => state.presentationMode);

  const mounted = useHydrated();
  const collapsed = mounted && collapsedPref;

  return (
    <div
      style={
        {
          "--sidebar-offset": collapsed ? "var(--sidebar-w-collapsed)" : "var(--sidebar-w)",
        } as React.CSSProperties
      }
      className="h-svh overflow-hidden bg-[var(--bg)]"
    >
      <SimulationEngine />
      <BootScreen />

      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <TopBar mounted={mounted} />
      <Sidebar mounted={mounted} />

      <div
        className={cn(
          "h-full pt-[var(--topbar-h)] transition-[padding] duration-[var(--t-slow)] ease-[var(--ease)]",
          "lg:pl-[var(--sidebar-offset)]",
        )}
      >
        {/* Keying on pathname resets each route's internal scroll position,
            which is the behaviour an operator expects when switching screens. */}
        <main
          id="main"
          key={pathname}
          className={cn("a-fade h-full min-h-0 overflow-hidden", presentationMode && "mx-auto max-w-[1920px]")}
        >
          {children}
        </main>
      </div>

      <CommandPalette />
      <PresenterConsole />
    </div>
  );
}

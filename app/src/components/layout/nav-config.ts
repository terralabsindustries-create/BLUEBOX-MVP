import type { LucideIcon } from "lucide-react";
import {
  Activity,
  CloudOff,
  FileText,
  Gauge,
  HardDrive,
  Map,
  Radar,
  Search,
  Settings,
  ShieldAlert,
  TrendingUp,
  TriangleAlert,
  Wrench,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Which store counter, if any, drives this item's badge. */
  counter?: "violations" | "tamper" | "offline" | "notices";
};

export type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

/**
 * Navigation follows the operational chain the platform implements:
 *
 *   COMMAND       what is happening now
 *   ENFORCEMENT   what that produced, and what to do about it
 *   FLEET         whether the devices reporting it can be trusted
 *   INTELLIGENCE  what it adds up to over time
 *   SYSTEM        how the deployment is configured
 *
 * Thirteen destinations is far too many for a flat list, and the grouping is
 * not cosmetic — it mirrors the system architecture, so an operator learns how
 * the platform works simply by reading the sidebar. Labels are deliberately
 * jurisdiction-neutral ("Notices", not "Challans"): the local term for a
 * notice is a property of the jurisdiction, not of the navigation.
 */
export const navGroups: NavGroup[] = [
  {
    id: "command",
    label: "Command",
    items: [
      { href: "/dashboard", label: "Overview", icon: Gauge },
      { href: "/live-vehicles", label: "Live Operations", icon: Radar },
      { href: "/map-heatmap", label: "Map", icon: Map },
    ],
  },
  {
    id: "enforcement",
    label: "Enforcement",
    items: [
      { href: "/violations", label: "Violations", icon: TriangleAlert, counter: "violations" },
      { href: "/challan-notices", label: "Notices", icon: FileText, counter: "notices" },
      { href: "/vehicle-search", label: "Vehicle Search", icon: Search },
    ],
  },
  {
    id: "fleet",
    label: "Fleet",
    items: [
      { href: "/device-health", label: "Devices", icon: HardDrive },
      { href: "/tamper-events", label: "Tamper Events", icon: ShieldAlert, counter: "tamper" },
      { href: "/offline-devices", label: "Offline Queue", icon: CloudOff, counter: "offline" },
      { href: "/fitment-centers", label: "Fitment Centers", icon: Wrench },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    items: [
      { href: "/analytics", label: "Analytics", icon: TrendingUp },
      { href: "/audit-logs", label: "Audit Trail", icon: Activity },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [{ href: "/system-settings", label: "Settings", icon: Settings }],
  },
];

export const navItems: NavItem[] = navGroups.flatMap((group) => group.items);

/**
 * Page identity.
 *
 * Operational language throughout: what the screen *is*, not what it promises.
 * The description is one line an officer could read aloud to explain the screen
 * to a colleague.
 */
export type PageCopy = {
  group: string;
  title: string;
  description: string;
};

export const pageCopy: Record<string, PageCopy> = {
  "/dashboard": {
    group: "Command",
    title: "Road Safety Operations",
    description: "Network status, live activity and items requiring action.",
  },
  "/live-vehicles": {
    group: "Command",
    title: "Live Operations",
    description: "Current telemetry and enforcement state across the tracked fleet.",
  },
  "/map-heatmap": {
    group: "Command",
    title: "Operations Map",
    description: "Spatial view of vehicles, violations and device incidents.",
  },
  "/violations": {
    group: "Enforcement",
    title: "Violations",
    description: "Signed evidence records and their verification state.",
  },
  "/challan-notices": {
    group: "Enforcement",
    title: "Notices",
    description: "Notice workflow. Proceeds only after backend verification passes.",
  },
  "/vehicle-search": {
    group: "Enforcement",
    title: "Vehicle Search",
    description: "Registry lookup by registration, device, owner or chassis.",
  },
  "/device-health": {
    group: "Fleet",
    title: "Device Fleet",
    description: "Subsystem diagnostics across every installed BlueBox device.",
  },
  "/tamper-events": {
    group: "Fleet",
    title: "Tamper Events",
    description: "Hardware and firmware integrity incidents requiring triage.",
  },
  "/offline-devices": {
    group: "Fleet",
    title: "Offline Queue",
    description: "Devices without a network route and the evidence they hold.",
  },
  "/fitment-centers": {
    group: "Fleet",
    title: "Fitment Centers",
    description: "Installation and activation performance by centre.",
  },
  "/analytics": {
    group: "Intelligence",
    title: "Analytics",
    description: "Enforcement trend, compliance, geographic risk and reliability.",
  },
  "/audit-logs": {
    group: "Intelligence",
    title: "Audit Trail",
    description: "Append-only record of every system and operator action.",
  },
  "/system-settings": {
    group: "System",
    title: "Settings",
    description: "Jurisdiction, enforcement policy, protocol, evidence and retention.",
  },
};

export function copyFor(pathname: string): PageCopy {
  return pageCopy[pathname] ?? pageCopy["/dashboard"];
}

/**
 * Product identity. Deliberately free of any jurisdiction: the deployment a
 * given install serves comes from `lib/jurisdiction`, never from here.
 */
export const PRODUCT = {
  name: "BlueBox One",
  vendor: "TerraLabs Industries",
  positioning: "Connected Road Safety & Enforcement Infrastructure",
  shortPositioning: "Road Safety Infrastructure",
} as const;

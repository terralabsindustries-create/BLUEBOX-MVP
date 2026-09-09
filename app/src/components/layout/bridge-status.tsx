"use client";

import { useEffect, useRef, useState } from "react";
import { Bluetooth, Box, Radio, Server } from "lucide-react";
import { ConnectivityIndicator, StatusDot } from "@/components/ui/status";
import { Field, FieldGrid } from "@/components/ui/panel";
import { useSimulationStore } from "@/store/simulation-store";
import { PHYSICAL_BLUEBOX } from "@/lib/physical-bluebox-protocol";
import { LINK_SEQUENCE, type LinkState, linkLabel, linkTone } from "@/lib/status";
import { cn } from "@/lib/utils";

/**
 * The transport readout.
 *
 * The demonstration runs over three links — the Android vehicle simulator, the
 * physical ESP32 BlueBox, and the local WebSocket bridge that is the
 * synchronisation authority between them.
 *
 * The top bar shows only the summary, because an enforcement officer does not
 * need a WebSocket URL to do their job. The engineering detail — RSSI, ACK
 * sequence, packet counts, firmware — is one click away for the technical
 * reviewer who does.
 *
 * The BLE mode label is never hidden or softened. "Mock" and "Real" are
 * materially different claims about what the dashboard is showing, and blurring
 * them would misrepresent the system to exactly the audience least able to
 * detect it.
 */

export type BridgeMode = "mock" | "real" | "unknown";

export function useBridgeSummary() {
  const android = useSimulationStore((state) => state.androidBleLink);
  const bridge = useSimulationStore((state) => state.dashboardBridgeLink);
  const physical = useSimulationStore((state) => state.physicalBluebox);
  const bridgeMode = useSimulationStore((state) => state.bridgeMode);

  const links: { key: string; label: string; detail: string; state: LinkState; icon: typeof Bluetooth }[] = [
    { key: "bridge", label: "Dashboard Bridge", detail: "ws://localhost:8765", state: bridge, icon: Server },
    { key: "android", label: "Vehicle Simulator", detail: "BLE peripheral", state: android, icon: Bluetooth },
    { key: "physical", label: "Physical BlueBox", detail: PHYSICAL_BLUEBOX.deviceId, state: physical.link, icon: Box },
  ];

  const connected = links.filter((link) => link.state === "connected").length;
  const worst: LinkState = bridge !== "connected" ? bridge : connected === links.length ? "connected" : "connecting";

  return { links, connected, total: links.length, mode: bridgeMode, worst, physical, bridge };
}

const MODE_LABEL: Record<BridgeMode, string> = {
  mock: "Mock BLE",
  real: "Live BLE",
  unknown: "No Bridge",
};

/** Compact indicator for the top bar. Opens the technical detail popover. */
export function BridgeStatusControl() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const { links, connected, total, worst, physical, mode } = useBridgeSummary();

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

  const tone = linkTone[worst];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "flex h-7 items-center gap-2 rounded-[var(--r-sm)] border px-2 transition-colors duration-[var(--t-fast)]",
          open ? "border-[var(--line-strong)] bg-[var(--chrome-hover)]" : "border-transparent hover:bg-[var(--chrome-hover)]",
        )}
      >
        <Radio className="h-3.5 w-3.5 text-[var(--text-4)]" strokeWidth={1.8} />
        <span
          className={cn(
            "text-[9.5px] font-bold uppercase tracking-[0.09em]",
            mode === "real" ? "text-[var(--ok-text)]" : mode === "mock" ? "text-[var(--warn-text)]" : "text-[var(--text-4)]",
          )}
        >
          {MODE_LABEL[mode]}
        </span>
        <span aria-hidden className="h-3 w-px bg-[var(--line)]" />
        <span className="t-num text-[11px] font-semibold text-[var(--text)]">
          {connected}/{total}
        </span>
        <StatusDot tone={tone} live={worst === "connected"} />
        <span className="sr-only">
          Transport links: {connected} of {total} connected. Bridge mode: {MODE_LABEL[mode]}.
        </span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Transport link detail"
          className="a-fade absolute right-0 top-[calc(100%+6px)] z-[var(--z-topbar)] w-[330px] rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--panel-raised)] shadow-[var(--shadow-float)]"
        >
          <div className="border-b border-[var(--line)] px-3 py-2.5">
            <p className="t-panel-title">Transport Links</p>
            <p className="t-meta mt-1 leading-snug">
              BLE is the tabletop demonstration transport only. The simulated M2M network is a separate,
              independent state and may be offline while these links are connected.
            </p>
          </div>

          <ul className="divide-y divide-[var(--line-soft)]">
            {links.map((link) => (
              <li key={link.key} className="flex items-center gap-2.5 px-3 py-2">
                <link.icon className="h-3.5 w-3.5 flex-none text-[var(--text-4)]" strokeWidth={1.7} />
                <ConnectivityIndicator state={link.state} label={link.label} detail={link.detail} className="flex-1" />
                <LinkProgress state={link.state} />
              </li>
            ))}
          </ul>

          <div className="border-t border-[var(--line)] bg-[var(--panel-sunken)] px-3 py-2.5">
            <FieldGrid columns={2} className="gap-y-2.5">
              <Field label="BLE Backend" value={mode === "real" ? "Windows native" : "Mock twin"} />
              <Field label="Firmware" value={physical.firmware} mono />
              <Field label="RSSI" value={physical.bleRssi === null ? "—" : `${physical.bleRssi} dBm`} mono />
              <Field
                label="Last ACK"
                value={physical.lastAckSequence === null ? "Waiting" : `#${physical.lastAckSequence}`}
                mono
              />
              <Field label="Packets RX / TX" value={`${physical.packetsRx} / ${physical.packetsTx}`} mono />
              <Field
                label="Display Mode"
                value={physical.displayMode}
                mono
                tone={physical.displayMode === "TAMPER_ALERT" ? "tamper" : undefined}
              />
            </FieldGrid>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The connection lifecycle, as four ticks.
 *
 * A link that snaps from false to true reads as fake. The bridge genuinely
 * passes through scanning, pairing and synchronizing before it is connected,
 * so showing the position in that sequence is honest *and* is what makes a
 * live BLE pairing feel like real hardware during a demonstration.
 */
function LinkProgress({ state }: Readonly<{ state: LinkState }>) {
  const index = LINK_SEQUENCE.indexOf(state);
  if (index === -1) return null;

  return (
    <span className="flex flex-none items-center gap-[3px]" title={linkLabel[state]}>
      {LINK_SEQUENCE.map((step, position) => (
        <span
          key={step}
          aria-hidden
          className={cn(
            "h-[3px] w-[9px] rounded-full transition-colors duration-[var(--t-base)]",
            position <= index ? "bg-[var(--ok)]" : "bg-[var(--surface-3)]",
            position === index && state !== "connected" && "a-urgent",
          )}
        />
      ))}
    </span>
  );
}

/** Full transport list for the Overview and Settings surfaces. */
export function TransportPanel({ className }: Readonly<{ className?: string }>) {
  const { links } = useBridgeSummary();

  return (
    <ul className={cn("divide-y divide-[var(--line-soft)] sm:flex sm:divide-x sm:divide-y-0", className)}>
      {links.map((link) => (
        <li key={link.key} className="flex min-w-0 flex-1 items-center gap-2 px-3.5 py-2.5">
          <link.icon className="h-3.5 w-3.5 flex-none text-[var(--text-4)]" strokeWidth={1.7} />
          <ConnectivityIndicator state={link.state} label={link.label} detail={link.detail} className="min-w-0 flex-1" />
          <LinkProgress state={link.state} />
        </li>
      ))}
    </ul>
  );
}

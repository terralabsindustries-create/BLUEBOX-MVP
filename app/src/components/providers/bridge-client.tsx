"use client";

import { useEffect } from "react";
import type { LinkStatus, PhysicalBlueboxStatus } from "@/lib/physical-bluebox-protocol";
import { useSimulationStore } from "@/store/simulation-store";

type BridgeMessage =
  | {
      type: "bridge_status";
      androidLink: LinkStatus;
      bridgeLink: LinkStatus;
      physical: PhysicalBlueboxStatus;
      mode?: "mock" | "real";
    }
  | {
      type: "android_telemetry";
      telemetry: {
        speedKph?: number;
        gnssStatus?: string;
        m2mNetwork?: string;
        powerStatus?: string;
        tamperStatus?: string;
      };
    }
  | { type: "physical_event"; eventType: "TAMPER_OPEN_EVENT" };

/**
 * The dashboard's end of the local bridge.
 *
 * The connection genuinely has stages, and the UI shows them rather than
 * flipping a boolean: `connecting` while the socket is opening, `synchronizing`
 * once it is open but before the bridge's first state snapshot has arrived
 * (the protocol has the bridge send a full snapshot and await acknowledgement
 * on connect), then `connected`. Every one of those states is a real condition
 * — none is a decorative delay.
 */
export function BridgeClient() {
  useEffect(() => {
    let socket: WebSocket | undefined;
    let retry: number | undefined;
    let closed = false;

    const connect = () => {
      const store = useSimulationStore.getState();
      store.setBridgeStatus({
        androidLink: store.androidBleLink,
        bridgeLink: "connecting",
        physical: store.physicalBluebox,
      });

      socket = new WebSocket("ws://localhost:8765");

      // Socket open, but the bridge has not yet published state: the link is
      // established and syncing, which is a different thing from connected.
      socket.onopen = () => {
        const current = useSimulationStore.getState();
        current.setBridgeStatus({
          androidLink: current.androidBleLink,
          bridgeLink: "synchronizing" as LinkStatus,
          physical: current.physicalBluebox,
        });
      };

      socket.onmessage = (event) => {
        const message = JSON.parse(event.data) as BridgeMessage;
        const current = useSimulationStore.getState();
        if (message.type === "bridge_status") current.setBridgeStatus(message);
        if (message.type === "android_telemetry") current.applyAndroidTelemetry(message.telemetry);
        if (message.type === "physical_event" && message.eventType === "TAMPER_OPEN_EVENT") {
          current.registerPhysicalTamper();
        }
      };

      socket.onclose = () => {
        if (closed) return;
        const current = useSimulationStore.getState();
        current.setBridgeStatus({
          androidLink: "unavailable",
          bridgeLink: "disconnected",
          physical: { ...current.physicalBluebox, link: "disconnected" },
        });
        retry = window.setTimeout(connect, 2000);
      };
    };

    const triggerMockTamper = () =>
      socket?.readyState === WebSocket.OPEN && socket.send(JSON.stringify({ type: "mock_physical_tamper" }));

    window.addEventListener("bluebox:mock-physical-tamper", triggerMockTamper);
    connect();

    return () => {
      closed = true;
      window.removeEventListener("bluebox:mock-physical-tamper", triggerMockTamper);
      if (retry) window.clearTimeout(retry);
      socket?.close();
    };
  }, []);

  return null;
}

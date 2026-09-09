"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useSimulationStore } from "@/store/simulation-store";
import { BridgeClient } from "@/components/providers/bridge-client";

/**
 * The clock behind the demonstration.
 *
 * One second of wall time is one tick of simulated time at 1×. The presenter's
 * 2× and 5× settings shorten the interval rather than skipping ticks, so the
 * ten-second qualification rule still evaluates every simulated second — the
 * rule is never fast-forwarded past, only watched more quickly.
 */
export function SimulationEngine() {
  const tickClock = useSimulationStore((state) => state.tickClock);
  const simulateTick = useSimulationStore((state) => state.simulateTick);
  const progressUploadSequence = useSimulationStore((state) => state.progressUploadSequence);
  const uploadSequence = useSimulationStore((state) => state.uploadSequence);
  const notifications = useSimulationStore((state) => state.notifications);
  const scenario = useSimulationStore((state) => state.scenario);
  const advanceScenario = useSimulationStore((state) => state.advanceScenario);
  const simulationSpeed = useSimulationStore((state) => state.simulationSpeed);
  const lastNotificationId = useRef<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      tickClock();
      simulateTick();
    }, 1000 / simulationSpeed);
    return () => window.clearInterval(timer);
  }, [simulateTick, tickClock, simulationSpeed]);

  useEffect(() => {
    if (uploadSequence.length === 0 || uploadSequence[0] === "Waiting for connectivity") return;
    const timer = window.setInterval(() => {
      progressUploadSequence();
    }, 1400 / simulationSpeed);
    return () => window.clearInterval(timer);
  }, [progressUploadSequence, uploadSequence, simulationSpeed]);

  useEffect(() => {
    if (!scenario.active) return;
    const timer = window.setInterval(() => {
      advanceScenario();
    }, 1500 / simulationSpeed);
    return () => window.clearInterval(timer);
  }, [advanceScenario, scenario.active, simulationSpeed]);

  // Surface only the newest alert, and only once.
  useEffect(() => {
    const latest = notifications[0];
    if (!latest || latest.id === lastNotificationId.current) return;
    lastNotificationId.current = latest.id;
    toast(latest.title, { description: latest.description });
  }, [notifications]);

  return <BridgeClient />;
}

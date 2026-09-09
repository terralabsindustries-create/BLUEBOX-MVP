"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  ActivityItem,
  AggregateMetrics,
  AppNotification,
  AuditLog,
  DeviceHealth,
  FitmentCenter,
  FlowStage,
  Notice,
  OfflineQueueItem,
  ScenarioPreset,
  TamperEvent,
  Vehicle,
  ViolationEvent,
} from "@/lib/types";
import { initialPhysicalBlueboxStatus, LinkStatus, PhysicalBlueboxStatus } from "@/lib/physical-bluebox-protocol";
import {
  createActivity,
  createAuditLogs,
  createDeviceHealth,
  createFitmentCenters,
  createMetrics,
  createNotices,
  createTamperEvents,
  createVehicles,
  createViolations,
} from "@/lib/mock-data/generate";
import { getViolationLevel, speedRule } from "@/lib/rules/speed-rule";
import { DEFAULT_JURISDICTION_ID } from "@/lib/jurisdiction";

type DemoScenarioId = "normal" | "overspeed" | "offline" | "tamper" | "gnss";

interface ScenarioState {
  active: DemoScenarioId | null;
  step: number;
}

interface SimulationState {
  hydrated: boolean;
  now: string;
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  presentationMode: boolean;
  demoControlsOpen: boolean;
  selectedVehicleId: string;
  selectedViolationId: string | null;
  selectedNoticeId: string | null;
  banner: string;
  autoRefresh: boolean;
  metrics: AggregateMetrics;
  vehicles: Vehicle[];
  violations: ViolationEvent[];
  tamperEvents: TamperEvent[];
  notices: Notice[];
  auditLogs: AuditLog[];
  deviceHealth: DeviceHealth[];
  fitmentCenters: FitmentCenter[];
  activity: ActivityItem[];
  notifications: AppNotification[];
  offlineQueue: OfflineQueueItem[];
  qualificationSeconds: number;
  qualificationActive: boolean;
  overspeedLatched: boolean;
  uploadSequence: string[];
  flowStage: FlowStage;
  scenario: ScenarioState;
  vehicleSearch: string;
  deviceHealthFilter: string;
  /** Active deployment. Presentation-only: the rule engine is unit-agnostic. */
  jurisdictionId: string;
  /** Presenter clock multiplier. Scales the engine's tick rate, not the rule. */
  simulationSpeed: 1 | 2 | 5;
  commandOpen: boolean;
  androidBleLink: LinkStatus;
  dashboardBridgeLink: LinkStatus;
  /** Reported by the bridge. Never inferred — see BridgeStatusControl. */
  bridgeMode: "mock" | "real" | "unknown";
  physicalBluebox: PhysicalBlueboxStatus;
  setHydrated: () => void;
  tickClock: () => void;
  setSidebarCollapsed: (value: boolean) => void;
  setMobileNavOpen: (value: boolean) => void;
  togglePresentationMode: () => void;
  toggleDemoControls: () => void;
  selectVehicle: (id: string) => void;
  selectViolation: (id: string | null) => void;
  selectNotice: (id: string | null) => void;
  setVehicleSearch: (value: string) => void;
  setDeviceHealthFilter: (value: string) => void;
  setJurisdiction: (id: string) => void;
  setSimulationSpeed: (value: 1 | 2 | 5) => void;
  setCommandOpen: (value: boolean) => void;
  pushActivity: (message: string, severity: ActivityItem["severity"]) => void;
  pushNotification: (title: string, description: string, severity: AppNotification["severity"]) => void;
  setSpeed: (speed: number) => void;
  setNetworkState: (mode: "online" | "offline" | "restore") => void;
  setGpsState: (mode: "valid" | "poor" | "lost" | "restore") => void;
  setPowerState: (mode: "normal" | "loss" | "restore") => void;
  setTamperState: (mode: Vehicle["telemetry"]["tamperState"]) => void;
  generateHeartbeat: () => void;
  clearDemo: () => void;
  resetSystem: () => void;
  simulateTick: () => void;
  progressUploadSequence: () => void;
  triggerScenario: (id: DemoScenarioId) => void;
  advanceScenario: () => void;
  setBridgeStatus: (status: { androidLink: LinkStatus; bridgeLink: LinkStatus; physical: PhysicalBlueboxStatus; mode?: "mock" | "real" | "unknown" }) => void;
  applyAndroidTelemetry: (telemetry: { speedKph?: number; gnssStatus?: string; m2mNetwork?: string; powerStatus?: string; tamperStatus?: string }) => void;
  registerPhysicalTamper: () => void;
}

const scenarioPresets: Record<DemoScenarioId, ScenarioPreset> = {
  normal: { id: "normal", title: "Scenario 1 - Normal Drive", description: "Speed 72 and all systems healthy." },
  overspeed: { id: "overspeed", title: "Scenario 2 - Overspeed", description: "Gradual rise to 92 km/h with qualified event." },
  offline: { id: "offline", title: "Scenario 3 - Offline Violation", description: "Offline signed event, queue, restore and upload." },
  tamper: { id: "tamper", title: "Scenario 4 - Tamper", description: "Power loss and enclosure open drive a critical state." },
  gnss: { id: "gnss", title: "Scenario 5 - GNSS Problem", description: "GNSS degrades and enforcement is suppressed." },
};

const seedNow = "2026-08-27T11:43:00+05:30";

function buildInitialState() {
  const vehicles = createVehicles(seedNow);
  const violations = createViolations(vehicles, seedNow);
  return {
    now: seedNow,
    metrics: createMetrics(),
    vehicles,
    violations,
    tamperEvents: createTamperEvents(vehicles, seedNow),
    notices: createNotices(violations),
    auditLogs: createAuditLogs(vehicles, seedNow),
    deviceHealth: createDeviceHealth(vehicles),
    fitmentCenters: createFitmentCenters(),
    activity: createActivity(seedNow),
  };
}

function updatePrimaryVehicle(vehicles: Vehicle[], updater: (vehicle: Vehicle) => Vehicle) {
  return vehicles.map((vehicle) => (vehicle.id === "vehicle-1" ? updater(vehicle) : vehicle));
}

function activity(timestamp: string, message: string, severity: ActivityItem["severity"]): ActivityItem {
  return { id: `activity-${crypto.randomUUID()}`, timestamp, message, severity };
}

function notification(title: string, description: string, severity: AppNotification["severity"]): AppNotification {
  return { id: crypto.randomUUID(), title, description, severity };
}

function uploadSequence() {
  return [
    "Connecting...",
    "Connected",
    "Uploading queued event...",
    "Server acknowledgement received",
    "Event uploaded",
    "Signature verifying...",
    "Verified",
    "Dashboard updated",
  ];
}

export const useSimulationStore = create<SimulationState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      sidebarCollapsed: false,
      mobileNavOpen: false,
      presentationMode: false,
      demoControlsOpen: false,
      selectedVehicleId: "vehicle-1",
      selectedViolationId: null,
      selectedNoticeId: null,
      banner: "MVP Simulation · Prototype Environment",
      autoRefresh: true,
      notifications: [],
      offlineQueue: [],
      qualificationSeconds: 0,
      qualificationActive: false,
      overspeedLatched: false,
      uploadSequence: [],
      flowStage: "GNSS DATA",
      scenario: { active: null, step: 0 },
      vehicleSearch: "",
      deviceHealthFilter: "All",
      jurisdictionId: DEFAULT_JURISDICTION_ID,
      simulationSpeed: 1,
      commandOpen: false,
      androidBleLink: "unavailable",
      dashboardBridgeLink: "disconnected",
      bridgeMode: "unknown",
      physicalBluebox: initialPhysicalBlueboxStatus,
      ...buildInitialState(),
      setHydrated: () => set({ hydrated: true }),
      tickClock: () => set((state) => ({ now: new Date(new Date(state.now).getTime() + 1000).toISOString() })),
      setSidebarCollapsed: (value) => set({ sidebarCollapsed: value }),
      setMobileNavOpen: (value) => set({ mobileNavOpen: value }),
      togglePresentationMode: () =>
        set((state) => ({
          presentationMode: !state.presentationMode,
          sidebarCollapsed: state.presentationMode ? false : true,
        })),
      toggleDemoControls: () => set((state) => ({ demoControlsOpen: !state.demoControlsOpen })),
      selectVehicle: (id) => set({ selectedVehicleId: id }),
      selectViolation: (id) => set({ selectedViolationId: id }),
      selectNotice: (id) => set({ selectedNoticeId: id }),
      setVehicleSearch: (value) => set({ vehicleSearch: value }),
      setDeviceHealthFilter: (value) => set({ deviceHealthFilter: value }),
      setJurisdiction: (id) => set({ jurisdictionId: id }),
      setSimulationSpeed: (value) => set({ simulationSpeed: value }),
      setCommandOpen: (value) => set({ commandOpen: value }),
      setBridgeStatus: ({ androidLink, bridgeLink, physical, mode }) =>
        set((state) => ({
          androidBleLink: androidLink,
          dashboardBridgeLink: bridgeLink,
          physicalBluebox: physical,
          // A reconnect frame without a mode must not silently downgrade the
          // label to "unknown" — keep the last value the bridge actually sent.
          bridgeMode: mode ?? state.bridgeMode,
        })),
      applyAndroidTelemetry: (telemetry) =>
        set((state) => ({
          vehicles: updatePrimaryVehicle(state.vehicles, (vehicle) => {
            const networkState = telemetry.m2mNetwork === "OFFLINE" ? "offline" : "online";
            const gpsLost = telemetry.gnssStatus === "LOST";
            const tamperState = telemetry.tamperStatus === "CASE OPEN" ? "case_open" : "normal";
            const powerState = telemetry.powerStatus === "LOSS" ? "loss" : "normal";
            return {
              ...vehicle,
              status: tamperState !== "normal" || powerState === "loss" ? "tamper" : networkState === "offline" ? "offline" : (telemetry.speedKph ?? vehicle.telemetry.speed) > speedRule.triggerSpeed ? "warning" : "active",
              telemetry: {
                ...vehicle.telemetry,
                speed: telemetry.speedKph ?? vehicle.telemetry.speed,
                networkState,
                signal: networkState === "offline" ? "NONE" : "STRONG",
                powerState,
                tamperState,
                gps: gpsLost ? { state: "lost", satellites: 0, hdop: 99, accuracy: "LOST", validFix: false } : { ...vehicle.telemetry.gps, state: "valid", validFix: true },
                lastUpdateAt: new Date().toISOString(),
              },
            };
          }),
        })),
      registerPhysicalTamper: () =>
        set((state) => ({
          physicalBluebox: { ...state.physicalBluebox, tamperSwitch: "CASE_OPEN", displayMode: "TAMPER_ALERT" },
          vehicles: updatePrimaryVehicle(state.vehicles, (vehicle) => ({ ...vehicle, status: "tamper", telemetry: { ...vehicle.telemetry, tamperState: "case_open", lastUpdateAt: state.now } })),
          tamperEvents: [{ id: `TMP-${crypto.randomUUID()}`, timestamp: state.now, vehicleId: "vehicle-1", vehicle: "KL 01 AB 1234", deviceId: "BB1-PROTOTYPE-01", location: "NH 66 · Kalamassery", eventType: "TAMPER_OPEN_EVENT", severity: "Critical", status: "Open", inspectionRequired: "Yes" }, ...state.tamperEvents],
          activity: [activity(state.now, "TAMPER_OPEN_EVENT received · Source: Physical BlueBox", "critical"), ...state.activity].slice(0, 40),
          notifications: [notification("Critical tamper alert", "Physical BlueBox enclosure opened for KL 01 AB 1234.", "critical"), ...state.notifications].slice(0, 12),
        })),
      pushActivity: (message, severity) =>
        set((state) => ({
          activity: [activity(state.now, message, severity), ...state.activity].slice(0, 40),
        })),
      pushNotification: (title, description, severity) =>
        set((state) => ({
          notifications: [notification(title, description, severity), ...state.notifications].slice(0, 12),
        })),
      setSpeed: (speed) =>
        set((state) => ({
          vehicles: updatePrimaryVehicle(state.vehicles, (vehicle) => ({
            ...vehicle,
            status: vehicle.telemetry.networkState === "offline" ? "offline" : speed > speedRule.triggerSpeed ? "warning" : "active",
            telemetry: {
              ...vehicle.telemetry,
              speed,
              lastUpdateAt: state.now,
            },
          })),
        })),
      setNetworkState: (mode) =>
        set((state) => {
          const nextState = mode === "restore" ? "online" : mode;
          const severity = mode === "offline" ? "warning" : "success";
          return {
            banner:
              mode === "offline"
                ? "NETWORK OFFLINE · GNSS monitoring active · local speed rule active · local storage active · signing active"
                : "Network restored. Offline queue synchronization ready.",
            vehicles: updatePrimaryVehicle(state.vehicles, (vehicle) => ({
              ...vehicle,
              status: nextState === "offline" ? "offline" : vehicle.telemetry.tamperState !== "normal" ? "tamper" : "active",
              telemetry: {
                ...vehicle.telemetry,
                networkState: nextState,
                signal: nextState === "offline" ? "NONE" : "STRONG",
                lastUpdateAt: state.now,
              },
            })),
            activity: [activity(state.now, mode === "offline" ? "Device network lost" : "Network restored", severity), ...state.activity].slice(0, 40),
            notifications: [
              notification(
                mode === "offline" ? "Device network lost" : "Network restored",
                mode === "offline"
                  ? "BlueBox continues offline-first monitoring with local event signing."
                  : "Queued evidence records will upload and verify automatically.",
                severity,
              ),
              ...state.notifications,
            ].slice(0, 12),
            uploadSequence: mode === "restore" && state.offlineQueue.length > 0 ? uploadSequence() : state.uploadSequence,
            flowStage: mode === "offline" ? "NETWORK?" : state.offlineQueue.length > 0 ? "RETRY" : "GNSS DATA",
          };
        }),
      setGpsState: (mode) =>
        set((state) => {
          const nextState = mode === "restore" ? "valid" : mode;
          const gpsMap = {
            valid: { satellites: 14, hdop: 0.8, accuracy: "GOOD" as const, validFix: true },
            poor: { satellites: 6, hdop: 2.5, accuracy: "POOR" as const, validFix: true },
            lost: { satellites: 0, hdop: 99, accuracy: "LOST" as const, validFix: false },
          };
          return {
            vehicles: updatePrimaryVehicle(state.vehicles, (vehicle) => ({
              ...vehicle,
              status: nextState === "lost" ? "warning" : vehicle.status,
              telemetry: {
                ...vehicle.telemetry,
                gps: { state: nextState, ...gpsMap[nextState] },
                lastUpdateAt: state.now,
              },
            })),
          };
        }),
      setPowerState: (mode) =>
        set((state) => ({
          vehicles: updatePrimaryVehicle(state.vehicles, (vehicle) => ({
            ...vehicle,
            status: mode === "loss" ? "tamper" : "active",
            telemetry: {
              ...vehicle.telemetry,
              powerState: mode === "restore" ? "normal" : mode,
              backupPower: mode === "loss" ? 61 : 93,
              lastUpdateAt: state.now,
            },
          })),
        })),
      setTamperState: (mode) =>
        set((state) => ({
          vehicles: updatePrimaryVehicle(state.vehicles, (vehicle) => ({
            ...vehicle,
            status: mode === "normal" ? "active" : "tamper",
            telemetry: {
              ...vehicle.telemetry,
              tamperState: mode,
              lastUpdateAt: state.now,
            },
          })),
        })),
      generateHeartbeat: () =>
        set((state) => ({
          vehicles: updatePrimaryVehicle(state.vehicles, (vehicle) => ({
            ...vehicle,
            telemetry: {
              ...vehicle.telemetry,
              heartbeatAt: state.now,
              lastUpdateAt: state.now,
            },
          })),
          activity: [activity(state.now, "Heartbeat generated", "info"), ...state.activity].slice(0, 40),
        })),
      clearDemo: () =>
        set((state) => ({
          vehicles: updatePrimaryVehicle(state.vehicles, (vehicle) => ({
            ...vehicle,
            status: "active",
            telemetry: {
              ...vehicle.telemetry,
              speed: 72,
              networkState: "online",
              signal: "STRONG",
              powerState: "normal",
              tamperState: "normal",
              gps: { state: "valid", satellites: 14, hdop: 0.8, accuracy: "GOOD", validFix: true },
              heartbeatAt: state.now,
              lastUpdateAt: state.now,
            },
          })),
          banner: "MVP Simulation · Prototype Environment",
          qualificationSeconds: 0,
          qualificationActive: false,
          overspeedLatched: false,
          flowStage: "GNSS DATA",
          uploadSequence: [],
          scenario: { active: null, step: 0 },
          offlineQueue: [],
        })),
      resetSystem: () =>
        set({
          ...buildInitialState(),
          hydrated: true,
          sidebarCollapsed: false,
          mobileNavOpen: false,
          presentationMode: false,
          demoControlsOpen: false,
          selectedVehicleId: "vehicle-1",
          selectedViolationId: null,
          selectedNoticeId: null,
          banner: "MVP Simulation · Prototype Environment",
          autoRefresh: true,
          notifications: [],
          offlineQueue: [],
          qualificationSeconds: 0,
          qualificationActive: false,
          overspeedLatched: false,
          uploadSequence: [],
          flowStage: "GNSS DATA",
          scenario: { active: null, step: 0 },
          vehicleSearch: "",
          deviceHealthFilter: "All",
          simulationSpeed: 1,
          commandOpen: false,
          androidBleLink: "unavailable",
          dashboardBridgeLink: "disconnected",
          bridgeMode: "unknown",
          physicalBluebox: initialPhysicalBlueboxStatus,
        }),
      simulateTick: () =>
        set((state) => {
          const vehicle = state.vehicles.find((item) => item.id === "vehicle-1");
          if (!vehicle) return {};
          const canEvaluate = vehicle.telemetry.gps.validFix && vehicle.telemetry.gps.state !== "lost";
          const overThreshold = vehicle.telemetry.speed > speedRule.triggerSpeed && canEvaluate;

          if (!overThreshold) {
            if (!state.qualificationActive) {
              return { flowStage: canEvaluate ? "GNSS DATA" : "GPS QUALITY" };
            }
            return {
              qualificationActive: false,
              qualificationSeconds: 0,
              overspeedLatched: false,
              flowStage: canEvaluate ? "GNSS DATA" : "GPS QUALITY",
              banner: vehicle.telemetry.speed <= speedRule.triggerSpeed ? "Speed normalized · event discarded" : "GNSS degraded · enforcement input suppressed",
              activity: [
                activity(
                  state.now,
                  vehicle.telemetry.speed <= speedRule.triggerSpeed
                    ? "Speed normalized · event discarded"
                    : "GNSS quality insufficient for enforcement input",
                  "info",
                ),
                ...state.activity,
              ].slice(0, 40),
            };
          }

          if (!state.qualificationActive) {
            return {
              qualificationActive: true,
              qualificationSeconds: 1,
              flowStage: "DURATION CHECK",
              banner: "Overspeed detected",
              activity: [activity(state.now, "Violation qualification started", "warning"), ...state.activity].slice(0, 40),
              notifications: [
                notification("Overspeed threshold crossed", `Violation qualification: 1 / ${speedRule.minimumViolationDuration} sec`, "warning"),
                ...state.notifications,
              ].slice(0, 12),
            };
          }

          if (state.overspeedLatched) {
            return {
              qualificationSeconds: Math.min(state.qualificationSeconds + 1, speedRule.minimumViolationDuration),
              flowStage: vehicle.telemetry.networkState === "offline" ? "QUEUE LOCALLY" : "SIMULATED NOTICE",
            };
          }

          const nextSeconds = state.qualificationSeconds + 1;
          if (nextSeconds < speedRule.minimumViolationDuration) {
            return {
              qualificationSeconds: nextSeconds,
              flowStage: "DURATION CHECK",
              notifications: [
                notification("Violation qualification started", `Violation qualification: ${nextSeconds} / ${speedRule.minimumViolationDuration} sec`, "warning"),
                ...state.notifications,
              ].slice(0, 12),
            };
          }

          const violationId = `BB1_KL_2026_${String(state.violations.length + 1).padStart(7, "0")}`;
          const isOffline = vehicle.telemetry.networkState === "offline";
          const violation: ViolationEvent = {
            id: violationId,
            eventType: "OVERSPEED_EVENT",
            vehicleId: vehicle.id,
            deviceId: vehicle.device.id,
            registrationNumber: vehicle.registrationNumber,
            timestamp: state.now,
            location: vehicle.telemetry.locationName,
            roadName: vehicle.telemetry.roadName,
            district: vehicle.telemetry.district,
            gpsSpeed: Number((vehicle.telemetry.speed + 0.4).toFixed(1)),
            maxSpeed: Number((vehicle.telemetry.speed + 2.1).toFixed(1)),
            roadLimit: vehicle.telemetry.roadLimit,
            tolerance: vehicle.telemetry.tolerance,
            durationSec: speedRule.minimumViolationDuration,
            level: getViolationLevel(vehicle.telemetry.speed),
            backendVerification: isOffline ? "PENDING" : "PASSED",
            duplicateCheck: isOffline ? "PENDING" : "PASSED",
            gpsQualityCheck: "PASSED",
            ruleValidation: isOffline ? "PENDING" : "PASSED",
            signatureStatus: isOffline ? "SIGNED LOCALLY" : "CRYPTOGRAPHIC SIGNATURE VERIFIED",
            networkStatusAtEvent: isOffline ? "OFFLINE_AT_EVENT" : "ONLINE",
            uploadStatus: isOffline ? "QUEUED" : "UPLOADED",
            hash: `9f1a7ce3${state.violations.length.toString(16).padStart(8, "0")}aebb031c1eec5522`,
            signature: `3045bb${state.violations.length.toString(16).padStart(8, "0")}aa92ff5533441122`,
          };
          const queueItem: OfflineQueueItem | null = isOffline
            ? { id: `queue-${crypto.randomUUID()}`, violationId, createdAt: state.now, status: "QUEUED" }
            : null;
          const notice: Notice = {
            id: `NTC-${String(state.notices.length + 1).padStart(4, "0")}`,
            violationId,
            registrationNumber: vehicle.registrationNumber,
            timestamp: state.now,
            status: isOffline ? "Pending Verification" : "Verified",
            verificationStatus: isOffline ? "Queued" : "PASSED",
            summary: "Prototype notice workflow. Final penalty determined by authorized backend policy.",
          };
          const auditEntry: AuditLog = {
            id: `AUD-${String(state.auditLogs.length + 1).padStart(4, "0")}`,
            timestamp: state.now,
            actor: "system.verifier",
            action: isOffline ? "EVENT_RECEIVED" : "EVENT_SIGNATURE_VERIFIED",
            entity: violationId,
            status: isOffline ? "PENDING" : "SUCCESS",
            hashRef: violation.hash.slice(0, 18),
          };

          return {
            metrics: {
              ...state.metrics,
              violationsToday: state.metrics.violationsToday + 1,
              noticesToday: String(Number(state.metrics.noticesToday.replace(/,/g, "")) + (isOffline ? 0 : 1)),
            },
            violations: [violation, ...state.violations],
            notices: [notice, ...state.notices],
            offlineQueue: queueItem ? [queueItem, ...state.offlineQueue] : state.offlineQueue,
            selectedViolationId: violationId,
            banner: isOffline
              ? "NETWORK OFFLINE · Signed evidence record queued locally · Waiting for connectivity"
              : "Signed overspeed event created · Backend verification completed",
            qualificationSeconds: speedRule.minimumViolationDuration,
            qualificationActive: true,
            overspeedLatched: true,
            flowStage: isOffline ? "QUEUE LOCALLY" : "SIMULATED NOTICE",
            uploadSequence: isOffline ? ["Waiting for connectivity"] : [],
            activity: [
              activity(state.now, "Violation duration reached 10 sec", "warning"),
              activity(state.now, "OVERSPEED_EVENT generated", "critical"),
              activity(state.now, isOffline ? "Event stored in offline queue" : "Backend verification passed", isOffline ? "warning" : "success"),
              ...state.activity,
            ].slice(0, 40),
            notifications: [
              notification(
                "OVERSPEED_EVENT created",
                isOffline ? "Signed locally and queued for backend verification." : "Cryptographic signature verified. Prototype notice workflow updated.",
                "critical",
              ),
              ...state.notifications,
            ].slice(0, 12),
            auditLogs: [auditEntry, ...state.auditLogs].slice(0, 50),
          };
        }),
      progressUploadSequence: () =>
        set((state) => {
          if (state.uploadSequence.length === 0 || state.uploadSequence[0] === "Waiting for connectivity") {
            return {};
          }
          const [current, ...rest] = state.uploadSequence;
          const done = rest.length === 0;
          const violations = done
            ? state.violations.map((violation, index) =>
                index === 0
                  ? {
                      ...violation,
                      backendVerification: "PASSED" as const,
                      duplicateCheck: "PASSED" as const,
                      ruleValidation: "PASSED" as const,
                      signatureStatus: "CRYPTOGRAPHIC SIGNATURE VERIFIED" as const,
                      uploadStatus: "UPLOADED" as const,
                    }
                  : violation,
              )
            : state.violations;
          const notices = done
            ? state.notices.map((notice, index) =>
                index === 0 ? { ...notice, status: "Notice Generated" as const, verificationStatus: "PASSED" } : notice,
              )
            : state.notices;
          return {
            uploadSequence: rest,
            offlineQueue: done ? [] : state.offlineQueue.map((item, index) => (index === 0 ? { ...item, status: "UPLOADING" as const } : item)),
            violations,
            notices,
            metrics: done ? { ...state.metrics, noticesToday: String(Number(state.metrics.noticesToday.replace(/,/g, "")) + 1) } : state.metrics,
            flowStage: done ? "SIMULATED NOTICE" : current.includes("Upload") ? "UPLOAD" : current.includes("Verify") ? "BACKEND VERIFY" : "RETRY",
            banner: current,
            activity: [activity(state.now, current, done ? "success" : "info"), ...state.activity].slice(0, 40),
          };
        }),
      triggerScenario: (id) => {
        const preset = scenarioPresets[id];
        get().clearDemo();
        get().pushActivity(`${preset.title} started`, "info");
        get().pushNotification("Scenario started", preset.description, "info");
        set({ scenario: { active: id, step: 0 } });
      },
      advanceScenario: () => {
        const current = get().scenario;
        if (!current.active) return;

        if (current.active === "normal") {
          if (current.step === 0) get().setSpeed(72);
          if (current.step > 1) set({ scenario: { active: null, step: current.step } });
        }

        if (current.active === "overspeed") {
          const steps = [72, 80, 84, 88, 92];
          if (steps[current.step] !== undefined) get().setSpeed(steps[current.step]);
          if (current.step > 5) set({ scenario: { active: null, step: current.step } });
        }

        if (current.active === "offline") {
          if (current.step === 0) get().setNetworkState("offline");
          if (current.step === 1) get().setSpeed(92);
          if (current.step === 14) get().setNetworkState("restore");
          if (current.step > 18) set({ scenario: { active: null, step: current.step } });
        }

        if (current.active === "tamper") {
          if (current.step === 0) get().setPowerState("loss");
          if (current.step === 1) get().setTamperState("case_open");
          if (current.step === 2) {
            set((state) => ({
              tamperEvents: [
                {
                  id: `TMP-${String(state.tamperEvents.length + 1).padStart(4, "0")}`,
                  timestamp: state.now,
                  vehicleId: "vehicle-1",
                  vehicle: "KL 01 AB 1234",
                  deviceId: "BB1-KL01-AB1234",
                  location: "NH 66 · Kalamassery",
                  eventType: "TAMPER_OPEN_EVENT",
                  severity: "Critical",
                  status: "Open",
                  inspectionRequired: "Yes",
                },
                ...state.tamperEvents,
              ],
            }));
          }
          if (current.step > 4) set({ scenario: { active: null, step: current.step } });
        }

        if (current.active === "gnss") {
          if (current.step === 0) get().setSpeed(72);
          if (current.step === 1) get().setGpsState("poor");
          if (current.step === 2) get().setGpsState("lost");
          if (current.step === 3) get().setSpeed(92);
          if (current.step > 5) set({ scenario: { active: null, step: current.step } });
        }

        set((state) => ({ scenario: { active: state.scenario.active, step: state.scenario.step + 1 } }));
      },
    }),
    {
      name: "bluebox-one-simulation-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        hydrated: true,
        now: state.now,
        sidebarCollapsed: state.sidebarCollapsed,
        mobileNavOpen: false,
        presentationMode: state.presentationMode,
        demoControlsOpen: state.demoControlsOpen,
        selectedVehicleId: state.selectedVehicleId,
        selectedViolationId: state.selectedViolationId,
        selectedNoticeId: state.selectedNoticeId,
        banner: state.banner,
        autoRefresh: state.autoRefresh,
        metrics: state.metrics,
        vehicles: state.vehicles,
        violations: state.violations,
        tamperEvents: state.tamperEvents,
        notices: state.notices,
        auditLogs: state.auditLogs,
        deviceHealth: state.deviceHealth,
        fitmentCenters: state.fitmentCenters,
        activity: state.activity,
        notifications: [],
        offlineQueue: state.offlineQueue,
        qualificationSeconds: state.qualificationSeconds,
        qualificationActive: state.qualificationActive,
        overspeedLatched: state.overspeedLatched,
        uploadSequence: state.uploadSequence,
        flowStage: state.flowStage,
        scenario: state.scenario,
        vehicleSearch: state.vehicleSearch,
        deviceHealthFilter: state.deviceHealthFilter,
        jurisdictionId: state.jurisdictionId,
        simulationSpeed: state.simulationSpeed,
        commandOpen: false,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);

export { scenarioPresets };

import { spawn } from "node:child_process";
import { WebSocketServer, WebSocket } from "ws";
import { initialPhysicalBlueboxStatus, type PhysicalBlueboxStatus } from "../../src/lib/physical-bluebox-protocol";

const port = Number(process.env.BLUEBOX_BRIDGE_PORT ?? 8765);
const realBleEnabled = process.env.BLUEBOX_BRIDGE_MODE === "real";
const mockEnabled = !realBleEnabled && process.env.MOCK_PHYSICAL_BLUEBOX !== "false";
let sequence = 0;
let physical: PhysicalBlueboxStatus = mockEnabled
  ? { ...initialPhysicalBlueboxStatus, link: "connected", bleRssi: -47, oledStatus: "READY", ledStatus: "READY", buzzerStatus: "READY", displayMode: "NORMAL_DRIVE" }
  : initialPhysicalBlueboxStatus;

const server = new WebSocketServer({ port });
const send = (socket: WebSocket, message: unknown) => socket.readyState === WebSocket.OPEN && socket.send(JSON.stringify(message));
const broadcast = (message: unknown) => server.clients.forEach((client) => send(client, message));
let androidLink: PhysicalBlueboxStatus["link"] = mockEnabled ? "connected" : "disconnected";
// The dashboard must state whether it is showing mock or real BLE. Only the
// bridge knows, so it says so on every status frame.
const bridgeMode = realBleEnabled ? "real" : "mock";
const publishState = () => broadcast({ type: "bridge_status", androidLink, bridgeLink: "connected", physical, mode: bridgeMode });

function setAndroidLink(link: PhysicalBlueboxStatus["link"]) {
  androidLink = link;
  publishState();
}

function setPhysicalLink(link: PhysicalBlueboxStatus["link"], updates: Partial<PhysicalBlueboxStatus> = {}) {
  physical = { ...physical, link, ...updates };
  publishState();
}

function startWindowsBleTransport() {
  const helper = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "bridge/windows-ble/run-ble-helper.ps1", "connect"], { stdio: ["ignore", "pipe", "pipe"] });
  helper.stdout.setEncoding("utf8"); helper.stderr.setEncoding("utf8");
  let outputBuffer = "";
  const handleHelperLine = (line: string) => {
    try {
      const message = JSON.parse(line) as { kind: string; state?: string; detail?: string; rssi?: number; payload?: Record<string, unknown> };
      if (message.kind === "status") {
        const link = message.state === "connected" ? "connected" : message.state === "connecting" || message.state === "scanning" ? "connecting" : "disconnected";
        setAndroidLink(link);
        console.log(`[BLE] ${message.state}: ${message.detail ?? ""}`);
      }
      if (message.kind === "physical_status") {
        const link = message.state === "connected" ? "connected" : message.state === "connecting" || message.state === "scanning" ? "connecting" : "disconnected";
        setPhysicalLink(link, { bleRssi: message.rssi ?? physical.bleRssi, oledStatus: link === "connected" ? "READY" : "OFFLINE", ledStatus: "OFFLINE", buzzerStatus: "OFFLINE" });
        console.log(`[PHYSICAL] ${message.state}: ${message.detail ?? ""}`);
      }
      if (message.kind === "found") console.log(`[BLE] found ${message.rssi ?? "?"} dBm`);
      if (message.kind === "physical_found") console.log(`[PHYSICAL] found ${message.rssi ?? "?"} dBm`);
      if (message.kind === "diagnostic") console.warn(`[BLE] ${message.detail}`);
      if (message.kind === "telemetry" && message.payload) {
        const telemetry = message.payload as { speedKph?: number; m2mNetwork?: string; gnssStatus?: string; tamperStatus?: string };
        const isOffline = telemetry.m2mNetwork === "OFFLINE";
        const isGnssLost = telemetry.gnssStatus === "LOST";
        const overSpeed = (telemetry.speedKph ?? 0) > 86;
        const displayMode = isGnssLost ? "GNSS_LOST" : isOffline ? "M2M_OFFLINE" : overSpeed ? "OVERSPEED_QUALIFYING" : "NORMAL_DRIVE";
        sequence += 1;
        physical = { ...physical, displayMode, packetsRx: physical.packetsRx + 1, packetsTx: physical.packetsTx + 1, lastAckSequence: sequence, lastSyncMs: 0, tamperSwitch: telemetry.tamperStatus === "CASE OPEN" ? "CASE_OPEN" : "NORMAL" };
        broadcast({ type: "android_telemetry", telemetry });
        broadcast({ type: "physical_ack", sequence, status: "APPLIED" });
        if (telemetry.tamperStatus === "CASE OPEN") broadcast({ type: "physical_event", eventType: "TAMPER_OPEN_EVENT", source: "ANDROID_SIMULATOR", timestamp: new Date().toISOString() });
        publishState();
        console.log(`[BLE RX] telemetry speed=${telemetry.speedKph ?? "?"}`);
      }
      if (message.kind === "physical_ack" && message.payload) {
        const ack = message.payload as { sequence?: number; status?: string };
        physical = { ...physical, lastAckSequence: ack.sequence ?? physical.lastAckSequence, packetsRx: physical.packetsRx + 1, lastSyncMs: 0 };
        broadcast({ type: "physical_ack", sequence: ack.sequence, status: ack.status ?? "APPLIED" });
        publishState();
      }
      if (message.kind === "physical_health" && message.payload) {
        const health = message.payload as { oledStatus?: string; ledStatus?: string; buzzerStatus?: string; displayStatus?: string; tamperStatus?: string };
        const dashboardStatus = (value: string | undefined): PhysicalBlueboxStatus["oledStatus"] => value === "READY" ? "READY" : value === "ERROR" ? "ERROR" : "OFFLINE";
        physical = { ...physical, oledStatus: dashboardStatus(health.oledStatus ?? health.displayStatus), ledStatus: dashboardStatus(health.ledStatus), buzzerStatus: dashboardStatus(health.buzzerStatus), tamperSwitch: health.tamperStatus === "CASE_OPEN" ? "CASE_OPEN" : "NORMAL" };
        publishState();
      }
    } catch { console.warn(`[BLE] Ignoring malformed helper output: ${line}`); }
  };
  helper.stdout.on("data", (data: string) => {
    outputBuffer += data;
    const lines = outputBuffer.split(/\r?\n/);
    outputBuffer = lines.pop() ?? "";
    lines.filter(Boolean).forEach(handleHelperLine);
  });
  helper.stderr.on("data", (data: string) => console.error(`[BLE] ${data.trim()}`));
  helper.on("exit", (code) => { setAndroidLink("disconnected"); setPhysicalLink("disconnected"); console.error(`[BLE] helper exited (${code ?? "unknown"})`); });
}

server.on("connection", (socket) => {
  send(socket, { type: "bridge_status", androidLink, bridgeLink: "connected", physical, mode: bridgeMode });
  socket.on("message", (raw) => {
    try {
      const message = JSON.parse(raw.toString()) as { type?: string; telemetry?: { speedKph?: number; m2mNetwork?: string; gnssStatus?: string } };
      if (message.type === "mock_physical_tamper" && mockEnabled) {
        physical = { ...physical, tamperSwitch: "CASE_OPEN", displayMode: "TAMPER_ALERT", packetsRx: physical.packetsRx + 1, packetsTx: physical.packetsTx + 1, lastSyncMs: 36 };
        broadcast({ type: "physical_event", eventType: "TAMPER_OPEN_EVENT", source: "PHYSICAL_BLUEBOX", deviceId: physical.deviceId, linkedVehicle: "KL01AB1234", tamperStatus: "CASE_OPEN", timestamp: new Date().toISOString() });
        publishState();
      }
      if (message.type === "android_telemetry" && message.telemetry) {
        const telemetry = message.telemetry;
        const isOffline = telemetry.m2mNetwork === "OFFLINE";
        const isGnssLost = telemetry.gnssStatus === "LOST";
        const overSpeed = (telemetry.speedKph ?? 0) > 86;
        const displayMode = isGnssLost ? "GNSS_LOST" : isOffline ? "M2M_OFFLINE" : overSpeed ? "OVERSPEED_QUALIFYING" : "NORMAL_DRIVE";
        sequence += 1;
        physical = { ...physical, displayMode, packetsRx: physical.packetsRx + 1, packetsTx: physical.packetsTx + 1, lastAckSequence: sequence, lastSyncMs: 32 };
        broadcast({ type: "physical_ack", sequence, status: "APPLIED" });
        broadcast({ type: "android_telemetry", telemetry });
        publishState();
      }
    } catch { send(socket, { type: "bridge_error", message: "Invalid JSON packet" }); }
  });
});

setInterval(() => { if (mockEnabled) { physical = { ...physical, packetsTx: physical.packetsTx + 1 }; publishState(); } }, 5000);
if (realBleEnabled) startWindowsBleTransport();
console.log(`BlueBox bridge listening on ws://localhost:${port} (${realBleEnabled ? "real Windows BLE" : mockEnabled ? "mock physical enabled" : "physical transport disabled"})`);

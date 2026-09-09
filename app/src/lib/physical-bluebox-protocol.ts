export const PHYSICAL_BLUEBOX = {
  advertisedName: "BlueBox-One-BB1",
  deviceId: "BB1-PROTOTYPE-01",
  linkedVehicle: "KL01AB1234",
  serviceUuid: "6E410001-B5A3-F393-E0A9-E50E24DCCA9E",
  stateCharacteristicUuid: "6E410002-B5A3-F393-E0A9-E50E24DCCA9E",
  eventCharacteristicUuid: "6E410003-B5A3-F393-E0A9-E50E24DCCA9E",
  commandCharacteristicUuid: "6E410004-B5A3-F393-E0A9-E50E24DCCA9E",
  healthCharacteristicUuid: "6E410005-B5A3-F393-E0A9-E50E24DCCA9E",
  ackCharacteristicUuid: "6E410006-B5A3-F393-E0A9-E50E24DCCA9E",
} as const;

export type LinkStatus = "connected" | "synchronizing" | "connecting" | "disconnected" | "unavailable";
export type PhysicalDisplayMode = "BOOT" | "READY" | "NORMAL_DRIVE" | "NEAR_LIMIT" | "OVERSPEED_QUALIFYING" | "OVERSPEED_EVENT" | "EVENT_SIGNED" | "EVENT_QUEUED" | "M2M_OFFLINE" | "NETWORK_RESTORED" | "UPLOADING" | "EVENT_VERIFIED" | "GNSS_LOST" | "POWER_LOSS" | "TAMPER_ALERT" | "ERROR";

export interface PhysicalBlueboxStatus {
  link: LinkStatus;
  deviceId: string;
  hardware: string;
  firmware: string;
  bleRssi: number | null;
  oledStatus: "READY" | "OFFLINE" | "ERROR";
  ledStatus: "READY" | "OFFLINE" | "ERROR";
  buzzerStatus: "READY" | "OFFLINE" | "ERROR";
  tamperSwitch: "NORMAL" | "CASE_OPEN";
  displayMode: PhysicalDisplayMode;
  lastSyncMs: number | null;
  packetsRx: number;
  packetsTx: number;
  lastAckSequence: number | null;
}

export const initialPhysicalBlueboxStatus: PhysicalBlueboxStatus = {
  link: "unavailable", deviceId: PHYSICAL_BLUEBOX.deviceId, hardware: "BlueBox One Prototype", firmware: "MVP-0.1.0",
  bleRssi: null, oledStatus: "OFFLINE", ledStatus: "OFFLINE", buzzerStatus: "OFFLINE", tamperSwitch: "NORMAL",
  displayMode: "BOOT", lastSyncMs: null, packetsRx: 0, packetsTx: 0, lastAckSequence: null,
};

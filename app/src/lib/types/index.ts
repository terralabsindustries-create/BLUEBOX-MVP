export type VehicleStatus = "active" | "warning" | "offline" | "tamper" | "service";
export type NetworkState = "online" | "offline" | "restoring";
export type GpsState = "valid" | "poor" | "lost";
export type PowerState = "normal" | "loss" | "backup";
export type TamperState =
  | "normal"
  | "case_open"
  | "device_unplugged"
  | "antenna_fault"
  | "firmware_integrity_failure";
export type ViolationLevel = "L0" | "L1" | "L2" | "L3" | "L4";
export type NoticeStatus =
  | "Pending Verification"
  | "Verified"
  | "Notice Generated"
  | "Warning Only"
  | "Under Review"
  | "Appeal Submitted"
  | "Closed";
export type FlowStage =
  | "GNSS DATA"
  | "SPEED RULE"
  | "TOLERANCE CHECK"
  | "DURATION CHECK"
  | "GPS QUALITY"
  | "CREATE EVENT"
  | "SIGN EVENT"
  | "NETWORK?"
  | "QUEUE LOCALLY"
  | "RETRY"
  | "UPLOAD"
  | "BACKEND VERIFY"
  | "SIMULATED NOTICE";

export interface GPSQuality {
  state: GpsState;
  satellites: number;
  hdop: number;
  accuracy: "GOOD" | "FAIR" | "POOR" | "LOST";
  validFix: boolean;
}

export interface Telemetry {
  speed: number;
  roadLimit: number;
  tolerance: number;
  heading: number;
  roadName: string;
  district: string;
  locationName: string;
  coordinates: [number, number];
  networkState: NetworkState;
  networkType: string;
  signal: "STRONG" | "GOOD" | "WEAK" | "NONE";
  powerState: PowerState;
  backupPower: number;
  tamperState: TamperState;
  heartbeatAt: string;
  lastUpdateAt: string;
  gps: GPSQuality;
}

export interface Device {
  id: string;
  serial: string;
  firmware: string;
  ruleVersion: string;
  installedAt: string;
  fitmentCenterId: string;
  connectivityUptime: number;
  storageUsed: number;
  uptimeHours: number;
}

export interface Vehicle {
  id: string;
  registrationNumber: string;
  ownerName: string;
  vehicleType: string;
  category: string;
  status: VehicleStatus;
  device: Device;
  telemetry: Telemetry;
  chassisReference: string;
  certificateRef: string;
  serviceStatus: string;
}

export interface ViolationEvent {
  id: string;
  eventType: "OVERSPEED_EVENT";
  vehicleId: string;
  deviceId: string;
  registrationNumber: string;
  timestamp: string;
  location: string;
  roadName: string;
  district: string;
  gpsSpeed: number;
  maxSpeed: number;
  roadLimit: number;
  tolerance: number;
  durationSec: number;
  level: ViolationLevel;
  backendVerification: "PASSED" | "PENDING";
  duplicateCheck: "PASSED" | "PENDING";
  gpsQualityCheck: "PASSED" | "PENDING";
  ruleValidation: "PASSED" | "PENDING";
  signatureStatus: "CRYPTOGRAPHIC SIGNATURE VERIFIED" | "SIGNED LOCALLY";
  networkStatusAtEvent: "ONLINE" | "OFFLINE_AT_EVENT";
  uploadStatus: "UPLOADED" | "QUEUED" | "VERIFYING";
  hash: string;
  signature: string;
}

export interface TamperEvent {
  id: string;
  timestamp: string;
  vehicleId: string;
  vehicle: string;
  deviceId: string;
  location: string;
  eventType:
    | "TAMPER_OPEN_EVENT"
    | "POWER_LOSS_EVENT"
    | "POWER_RESTORE_EVENT"
    | "GNSS_LOSS_EVENT"
    | "GNSS_SUSPECT_EVENT"
    | "NETWORK_LOSS_EVENT"
    | "NETWORK_RESTORE_EVENT"
    | "FIRMWARE_INTEGRITY_EVENT"
    | "LOW_BACKUP_POWER_EVENT";
  severity: "Low" | "Medium" | "High" | "Critical";
  status: "Open" | "Investigating" | "Resolved";
  inspectionRequired: "Yes" | "No";
}

export interface Heartbeat {
  id: string;
  vehicleId: string;
  timestamp: string;
  state: "Delivered" | "Queued";
}

export interface DeviceHealth {
  deviceId: string;
  vehicle: string;
  online: string;
  gnss: string;
  signal: string;
  vehiclePower: string;
  backupPower: string;
  tamper: string;
  firmware: string;
  ruleVersion: string;
  storage: string;
  lastHeartbeat: string;
  uptime: string;
  health: "Healthy" | "Warning" | "Offline" | "Tamper" | "Service Required";
}

export interface FitmentCenter {
  id: string;
  name: string;
  district: string;
  installedDevices: number;
  activeDevices: number;
  failedInstallations: number;
  serviceRequests: number;
  lastActivation: string;
  status: "Operational" | "Watch" | "Escalated";
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor: string;
  action:
    | "DEVICE_ACTIVATED"
    | "RULE_UPDATED"
    | "EVENT_RECEIVED"
    | "EVENT_SIGNATURE_VERIFIED"
    | "EVENT_RECONCILED"
    | "NOTICE_CREATED"
    | "TAMPER_FLAGGED"
    | "OFFICER_VIEWED_RECORD"
    | "ADMIN_UPDATED_RULE";
  entity: string;
  status: "SUCCESS" | "PENDING" | "REVIEW";
  hashRef: string;
}

export interface Notice {
  id: string;
  violationId: string;
  registrationNumber: string;
  timestamp: string;
  status: NoticeStatus;
  verificationStatus: string;
  summary: string;
}

export interface RuleConfiguration {
  defaultRoadLimit: number;
  tolerance: number;
  triggerSpeed: number;
  minimumViolationDuration: number;
  ruleVersion: string;
}

export interface OfflineQueueItem {
  id: string;
  violationId: string;
  createdAt: string;
  status: "QUEUED" | "UPLOADING" | "UPLOADED";
}

export interface ActivityItem {
  id: string;
  timestamp: string;
  message: string;
  severity: "info" | "success" | "warning" | "critical";
}

export interface AppNotification {
  id: string;
  title: string;
  description: string;
  severity: "info" | "success" | "warning" | "critical";
}

export interface AggregateMetrics {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  tamperAlerts: number;
  violationsToday: number;
  noDataDevices: number;
  totalVehiclesProtected: string;
  totalKilometersToday: string;
  dataEventsProcessed: string;
  noticesToday: string;
}

export interface ScenarioPreset {
  id: string;
  title: string;
  description: string;
}

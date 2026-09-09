import {
  ActivityItem,
  AggregateMetrics,
  AuditLog,
  DeviceHealth,
  FitmentCenter,
  Notice,
  TamperEvent,
  Vehicle,
  ViolationEvent,
} from "@/lib/types";
import { speedRule } from "@/lib/rules/speed-rule";

const districts = ["Ernakulam", "Thrissur", "Kottayam", "Idukki", "Alappuzha"];
const roads = [
  "NH 66 · Kochi",
  "NH 66 · Kalamassery",
  "NH 66 · Aluva",
  "NH 66 · Angamaly",
  "NH 544 · Perumbavoor",
  "MC Road · Kochi",
  "Thrissur Road",
];
const names = [
  "Arun Kumar",
  "Neha Pillai",
  "Ranjith Nair",
  "Akhil Raj",
  "Meera Joseph",
  "Devika Mohan",
  "Jithin Das",
  "Asha Menon",
];
const coords: Record<string, [number, number]> = {
  Kochi: [9.9312, 76.2673],
  Kalamassery: [10.052, 76.328],
  Aluva: [10.1076, 76.3516],
  Angamaly: [10.196, 76.386],
  Perumbavoor: [10.115, 76.4737],
};

function pad(value: number) {
  return value.toString().padStart(4, "0");
}

function hash(seed: number) {
  return `9f1a7ce3${seed.toString(16).padStart(8, "0")}b4ef7231c9d2a0${seed.toString(16).padStart(4, "0")}`;
}

export function createVehicles(now: string): Vehicle[] {
  const places = [
    { name: "Kalamassery", road: "NH 66 · Kalamassery", district: "Ernakulam" },
    { name: "Kochi", road: "MC Road · Kochi", district: "Ernakulam" },
    { name: "Aluva", road: "NH 66 · Aluva", district: "Ernakulam" },
    { name: "Angamaly", road: "NH 66 · Angamaly", district: "Ernakulam" },
    { name: "Perumbavoor", road: "NH 544 · Perumbavoor", district: "Ernakulam" },
  ];

  return Array.from({ length: 50 }, (_, index) => {
    const place = places[index % places.length];
    const deviceId = index === 0 ? "BB1-KL01-AB1234" : `BB1-KL${(index + 1).toString().padStart(2, "0")}-X${pad(index + 1)}`;
    const registrationNumber =
      index === 0 ? "KL 01 AB 1234" : `KL ${(index + 1).toString().padStart(2, "0")} ${String.fromCharCode(65 + (index % 20))}${String.fromCharCode(66 + (index % 20))} ${1000 + index}`;
    const speed = index === 0 ? 72 : 48 + (index % 7) * 7;
    const status = index % 11 === 0 ? "offline" : index % 13 === 0 ? "tamper" : index % 5 === 0 ? "warning" : "active";
    const location = coords[place.name];

    return {
      id: `vehicle-${index + 1}`,
      registrationNumber,
      ownerName: names[index % names.length],
      vehicleType: index % 3 === 0 ? "Car" : index % 3 === 1 ? "Bus" : "Goods Carrier",
      category: index % 3 === 0 ? "Private" : index % 3 === 1 ? "Passenger" : "Commercial",
      status,
      chassisReference: `CHS-KL-${pad(index + 1)}-${2026 + index}`,
      certificateRef: `CERT-${index + 1}-KL`,
      serviceStatus: index % 9 === 0 ? "Inspection due" : "In service",
      device: {
        id: deviceId,
        serial: `SN-BB1-${pad(index + 1)}`,
        firmware: index === 0 ? "1.0.3" : index % 4 === 0 ? "1.0.2" : "1.0.3",
        ruleVersion: speedRule.ruleVersion,
        installedAt: index === 0 ? "2026-04-18T09:00:00+05:30" : `2026-0${(index % 5) + 1}-1${index % 9}T10:00:00+05:30`,
        fitmentCenterId: `FC-${(index % 12) + 1}`,
        connectivityUptime: 99.1 - (index % 8) * 0.2,
        storageUsed: 28 + (index % 50),
        uptimeHours: 240 + index * 3,
      },
      telemetry: {
        speed,
        roadLimit: speedRule.defaultRoadLimit,
        tolerance: speedRule.tolerance,
        heading: 90 + index * 3,
        roadName: place.road,
        district: place.district,
        locationName: `${place.name}, Kochi`,
        coordinates: [location[0] + index * 0.002, location[1] + index * 0.0025],
        networkState: status === "offline" ? "offline" : "online",
        networkType: "4G / M2M",
        signal: status === "offline" ? "NONE" : status === "warning" ? "WEAK" : "STRONG",
        powerState: status === "tamper" ? "backup" : "normal",
        backupPower: 88 - (index % 6) * 5,
        tamperState: status === "tamper" ? "case_open" : "normal",
        heartbeatAt: new Date(new Date(now).getTime() - (index + 1) * 1000 * 12).toISOString(),
        lastUpdateAt: new Date(new Date(now).getTime() - (index + 1) * 1000 * 8).toISOString(),
        gps: {
          state: status === "warning" ? "poor" : "valid",
          satellites: index === 0 ? 14 : 8 + (index % 7),
          hdop: index === 0 ? 0.8 : 0.7 + (index % 4) * 0.4,
          accuracy: status === "warning" ? "FAIR" : "GOOD",
          validFix: status !== "offline",
        },
      },
    };
  });
}

export function createViolations(vehicles: Vehicle[], now: string): ViolationEvent[] {
  return Array.from({ length: 100 }, (_, index) => {
    const vehicle = vehicles[index % vehicles.length];
    const speed = 87 + (index % 5) * 6;
    return {
      id: index === 0 ? "BB1_KL_2026_0000001" : `BB1_KL_2026_${pad(index + 1)}`,
      eventType: "OVERSPEED_EVENT",
      vehicleId: vehicle.id,
      deviceId: vehicle.device.id,
      registrationNumber: vehicle.registrationNumber,
      timestamp: new Date(new Date(now).getTime() - (index + 1) * 1000 * 49).toISOString(),
      location: vehicle.telemetry.locationName,
      roadName: roads[index % roads.length],
      district: districts[index % districts.length],
      gpsSpeed: speed + 0.4,
      maxSpeed: speed + 2.1,
      roadLimit: speedRule.defaultRoadLimit,
      tolerance: speedRule.tolerance,
      durationSec: 11 + (index % 9),
      level: speed <= 95 ? "L1" : speed <= 110 ? "L2" : "L3",
      backendVerification: "PASSED",
      duplicateCheck: "PASSED",
      gpsQualityCheck: "PASSED",
      ruleValidation: "PASSED",
      signatureStatus: "CRYPTOGRAPHIC SIGNATURE VERIFIED",
      networkStatusAtEvent: index % 4 === 0 ? "OFFLINE_AT_EVENT" : "ONLINE",
      uploadStatus: "UPLOADED",
      hash: hash(index + 1),
      signature: hash(index + 101),
    };
  });
}

export function createTamperEvents(vehicles: Vehicle[], now: string): TamperEvent[] {
  const types = [
    "TAMPER_OPEN_EVENT",
    "POWER_LOSS_EVENT",
    "POWER_RESTORE_EVENT",
    "GNSS_LOSS_EVENT",
    "GNSS_SUSPECT_EVENT",
    "NETWORK_LOSS_EVENT",
    "NETWORK_RESTORE_EVENT",
    "FIRMWARE_INTEGRITY_EVENT",
    "LOW_BACKUP_POWER_EVENT",
  ] as const;
  return Array.from({ length: 25 }, (_, index) => {
    const vehicle = vehicles[index % vehicles.length];
    const eventType = types[index % types.length];
    return {
      id: `TMP-${pad(index + 1)}`,
      timestamp: new Date(new Date(now).getTime() - (index + 1) * 1000 * 180).toISOString(),
      vehicleId: vehicle.id,
      vehicle: vehicle.registrationNumber,
      deviceId: vehicle.device.id,
      location: vehicle.telemetry.roadName,
      eventType,
      severity: eventType.includes("LOSS") ? "High" : eventType.includes("FIRMWARE") ? "Critical" : "Medium",
      status: index % 3 === 0 ? "Resolved" : index % 2 === 0 ? "Investigating" : "Open",
      inspectionRequired: eventType.includes("RESTORE") ? "No" : "Yes",
    };
  });
}

export function createFitmentCenters(): FitmentCenter[] {
  return Array.from({ length: 12 }, (_, index) => ({
    id: `FC-${index + 1}`,
    name: index === 11 ? "Kochi Center 12" : `Center ${index + 1}`,
    district: districts[index % districts.length],
    installedDevices: 680 + index * 38,
    activeDevices: 650 + index * 35,
    failedInstallations: 3 + (index % 4),
    serviceRequests: 11 + index,
    lastActivation: `2026-08-${(index + 8).toString().padStart(2, "0")}T10:30:00+05:30`,
    status: index % 7 === 0 ? "Watch" : index % 11 === 0 ? "Escalated" : "Operational",
  }));
}

export function createDeviceHealth(vehicles: Vehicle[]): DeviceHealth[] {
  return vehicles.map((vehicle) => ({
    deviceId: vehicle.device.id,
    vehicle: vehicle.registrationNumber,
    online: vehicle.telemetry.networkState.toUpperCase(),
    gnss: vehicle.telemetry.gps.state.toUpperCase(),
    signal: vehicle.telemetry.signal,
    vehiclePower: vehicle.telemetry.powerState.toUpperCase(),
    backupPower: `${vehicle.telemetry.backupPower}%`,
    tamper: vehicle.telemetry.tamperState.toUpperCase(),
    firmware: vehicle.device.firmware,
    ruleVersion: vehicle.device.ruleVersion,
    storage: `${vehicle.device.storageUsed}%`,
    lastHeartbeat: vehicle.telemetry.heartbeatAt,
    uptime: `${vehicle.device.uptimeHours} h`,
    health:
      vehicle.status === "tamper"
        ? "Tamper"
        : vehicle.status === "offline"
          ? "Offline"
          : vehicle.status === "warning"
            ? "Warning"
            : "Healthy",
  }));
}

export function createAuditLogs(vehicles: Vehicle[], now: string): AuditLog[] {
  const actions: AuditLog["action"][] = [
    "DEVICE_ACTIVATED",
    "RULE_UPDATED",
    "EVENT_RECEIVED",
    "EVENT_SIGNATURE_VERIFIED",
    "EVENT_RECONCILED",
    "NOTICE_CREATED",
    "TAMPER_FLAGGED",
    "OFFICER_VIEWED_RECORD",
    "ADMIN_UPDATED_RULE",
  ];
  return Array.from({ length: 40 }, (_, index) => ({
    id: `AUD-${pad(index + 1)}`,
    timestamp: new Date(new Date(now).getTime() - index * 1000 * 90).toISOString(),
    actor: index % 5 === 0 ? "system.verifier" : index % 3 === 0 ? "admin.control" : "officer.mvd",
    action: actions[index % actions.length],
    entity: vehicles[index % vehicles.length].device.id,
    status: index % 4 === 0 ? "PENDING" : "SUCCESS",
    hashRef: hash(index + 301).slice(0, 18),
  }));
}

export function createNotices(violations: ViolationEvent[]): Notice[] {
  return violations.slice(0, 20).map((violation, index) => ({
    id: `NTC-${pad(index + 1)}`,
    violationId: violation.id,
    registrationNumber: violation.registrationNumber,
    timestamp: violation.timestamp,
    status: index % 6 === 0 ? "Pending Verification" : index % 5 === 0 ? "Under Review" : "Notice Generated",
    verificationStatus: violation.backendVerification,
    summary: `Prototype notice workflow for ${violation.roadName}`,
  }));
}

export function createActivity(now: string): ActivityItem[] {
  return [
    {
      id: "activity-1",
      timestamp: new Date(new Date(now).getTime() - 16000).toISOString(),
      message: "KL 01 AB 1234 crossed 86 km/h threshold",
      severity: "warning",
    },
    {
      id: "activity-2",
      timestamp: new Date(new Date(now).getTime() - 13000).toISOString(),
      message: "Overspeed duration 3 sec",
      severity: "warning",
    },
    {
      id: "activity-3",
      timestamp: new Date(new Date(now).getTime() - 6000).toISOString(),
      message: "Event signature generated",
      severity: "success",
    },
    {
      id: "activity-4",
      timestamp: new Date(new Date(now).getTime() - 5000).toISOString(),
      message: "Backend verification passed",
      severity: "success",
    },
  ];
}

export function createMetrics(): AggregateMetrics {
  return {
    totalDevices: 12482,
    onlineDevices: 12106,
    offlineDevices: 218,
    tamperAlerts: 47,
    violationsToday: 1384,
    noDataDevices: 111,
    totalVehiclesProtected: "1,24,82,931",
    totalKilometersToday: "28,47,392 km",
    dataEventsProcessed: "45,67,322",
    noticesToday: "1,028",
  };
}

# Physical BlueBox One Protocol

## MVP architecture

The laptop bridge is the synchronization authority. Android Vehicle Simulator and the ESP32 Physical BlueBox connect to the laptop over BLE in the production demo transport. The bridge publishes normalized state to the dashboard over `ws://localhost:8765`.

BLE is only the tabletop MVP transport. The simulated M2M network remains a separate production-concept status and can be offline while both BLE links are connected.

## Identity and BLE service

- Advertised name: `BlueBox-One-BB1`
- Device ID: `BB1-PROTOTYPE-01`
- Linked vehicle: `KL01AB1234`
- Service: `6E410001-B5A3-F393-E0A9-E50E24DCCA9E`
- State: `6E410002-B5A3-F393-E0A9-E50E24DCCA9E`
- Event: `6E410003-B5A3-F393-E0A9-E50E24DCCA9E`
- Command: `6E410004-B5A3-F393-E0A9-E50E24DCCA9E`
- Health: `6E410005-B5A3-F393-E0A9-E50E24DCCA9E`
- ACK: `6E410006-B5A3-F393-E0A9-E50E24DCCA9E`

All constants are centralized in `src/lib/physical-bluebox-protocol.ts`.

## State packet

```json
{
  "protocolVersion": "1.0",
  "type": "physical_state",
  "sequence": 142,
  "deviceId": "BB1-PROTOTYPE-01",
  "vehicle": "KL01AB1234",
  "speedKph": 92.4,
  "roadLimitKph": 80,
  "toleranceKph": 6,
  "gnssStatus": "VALID",
  "m2mNetwork": "OFFLINE",
  "tamperStatus": "NORMAL",
  "offlineQueueCount": 1,
  "eventState": "EVENT_QUEUED",
  "displayMode": "EVENT_QUEUED",
  "ledState": "OFFLINE",
  "buzzerCommand": "EVENT_BEEP"
}
```

Display modes: `BOOT`, `READY`, `NORMAL_DRIVE`, `NEAR_LIMIT`, `OVERSPEED_QUALIFYING`, `OVERSPEED_EVENT`, `EVENT_SIGNED`, `EVENT_QUEUED`, `M2M_OFFLINE`, `NETWORK_RESTORED`, `UPLOADING`, `EVENT_VERIFIED`, `GNSS_LOST`, `POWER_LOSS`, `TAMPER_ALERT`, `ERROR`.

## Events, health, and ACK

Physical tamper must notify the event characteristic immediately:

```json
{"protocolVersion":"1.0","type":"physical_event","source":"PHYSICAL_BLUEBOX","eventType":"TAMPER_OPEN_EVENT","deviceId":"BB1-PROTOTYPE-01","linkedVehicle":"KL01AB1234","tamperStatus":"CASE_OPEN"}
```

Send health approximately every five seconds with firmware version, uptime, RSSI, OLED/LED/buzzer status, tamper switch state, free heap, and last error. ACK every accepted state write with `{"type":"ack","sequence":142,"status":"APPLIED"}`.

Keep payloads compact and transport framing isolated. Negotiate MTU where available; otherwise chunk packets before BLE writes. The dashboard should never depend on BLE packet framing.

## Reconnect behavior

On reconnect, the bridge sends a complete state snapshot, waits for an ACK, then marks the physical twin synchronized. Retry conservatively and avoid repeated BLE writes. Physical disconnection must not interrupt Android or internal dashboard simulation.

# Android Vehicle Simulator BLE Protocol

The Android app is a BLE GATT peripheral named `BlueBox-VehicleSim`. The Windows laptop bridge is its BLE central/GATT client. This is the MVP demonstration link and is independent of the simulated M2M network.

## UUIDs

| Channel | UUID |
| --- | --- |
| Service | `6E420001-B5A3-F393-E0A9-E50E24DCCA9E` |
| Telemetry notify | `6E420002-B5A3-F393-E0A9-E50E24DCCA9E` |
| Event notify | `6E420003-B5A3-F393-E0A9-E50E24DCCA9E` |
| Command write | `6E420004-B5A3-F393-E0A9-E50E24DCCA9E` |
| Health notify | `6E420005-B5A3-F393-E0A9-E50E24DCCA9E` |
| ACK notify | `6E420006-B5A3-F393-E0A9-E50E24DCCA9E` |

The phone emits a compact JSON telemetry snapshot after state changes and the bridge should subscribe to notifications. The target cadence is 500 ms after the Windows BLE central adapter is enabled.

```json
{"protocolVersion":"1.0","type":"telemetry","deviceId":"BB1-KL01-AB1234","vehicle":"KL01AB1234","speedKph":92,"roadLimitKph":80,"toleranceKph":6,"gnssStatus":"VALID","m2mNetwork":"ONLINE","powerStatus":"NORMAL","tamperStatus":"NORMAL","offlineQueueCount":0}
```

Commands are UTF-8 JSON or command strings written to the command characteristic: `SET_SPEED`, `SET_SCENARIO`, `RESTORE_SYSTEM`, `SET_ROAD_LIMIT`, `SET_TOLERANCE`, `PING`, and `REQUEST_STATE`. The present Android MVP handles `REQUEST_STATE`; the remaining commands are reserved for the bridge adapter.

Events include `OVERSPEED_EVENT`, `NETWORK_LOSS_EVENT`, `NETWORK_RESTORE_EVENT`, `POWER_LOSS_EVENT`, `GNSS_LOSS_EVENT`, and `TAMPER_OPEN_EVENT`. Android tamper has source `ANDROID_SIMULATOR`; ESP32 tamper must retain source `PHYSICAL_BLUEBOX`.

BLE notifications are MTU-aware. The Android peripheral Base64-encodes each JSON snapshot and splits it into frames of at most 20 bytes: `0x42 0x31 messageId partIndex partCount payload...` (`0x42 0x31` is ASCII `B1`). The Windows bridge reassembles all parts before parsing JSON. The Android peripheral owns its current state and sends a complete snapshot after reconnect; the laptop bridge remains the synchronization authority for the three-system demonstration.

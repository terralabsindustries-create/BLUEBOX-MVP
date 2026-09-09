# BlueBox One

**TerraLabs Industries** · Connected Road Safety & Enforcement Infrastructure

An offline-first road-safety enforcement and connected-vehicle operations platform.
This repository is the control-room dashboard, the local BLE bridge and the ESP32
device protocol that together form the demonstration system.

> **Jurisdiction:** Kerala, India — *Demonstration jurisdiction.*
> BlueBox One is not Kerala-specific software. Kerala is one provisioned
> deployment; units, locale, timezone, currency, plate format and enforcement
> notice terminology all come from the jurisdiction layer and can be switched
> from the top bar.

---

## Stack

- Next.js 16 · React 19 · TypeScript
- Tailwind CSS 4 with a token-driven design system
- Zustand + `localStorage` persistence
- Recharts · Leaflet / React Leaflet
- Geist + Geist Mono (self-hosted via `next/font`, no runtime network calls)
- Local WebSocket bridge (`ws`) to the Android simulator and the physical ESP32 device

---

## Run

```bash
npm install
npm run dev          # dashboard on :3000
npm run bridge:mock  # BLE bridge on :8765, in a second terminal
```

Open `http://localhost:3000`.

Optional companion processes:

```bash
npm run bridge:mock-android   # normal → overspeed telemetry
npm run bridge:mock-tamper    # physical-origin tamper event
```

### Production check

```bash
npm run lint
npm run build
```

---

## Architecture

```
ANDROID VEHICLE SIMULATOR ─┐
                           ├─BLE→ LAPTOP BRIDGE ─ws://localhost:8765→ DASHBOARD
PHYSICAL BLUEBOX (ESP32) ──┘        (sync authority)
```

BLE is the tabletop demonstration transport only. The simulated M2M network is a
separate production-concept state and may be offline while both BLE links are up.

### The enforcement chain

```
DEVICE                         BACKEND              AUTHORITY
detect → qualify → sign   →   verify         →     enforcement policy
```

The device never determines a penalty. It detects a condition, qualifies it
against the speed rule, and cryptographically signs an evidence record. A backend
verifies that record. Any consequence is decided by authority policy. Every
surface in the UI preserves that boundary.

### The speed rule

```
limit 80 km/h  +  tolerance 6  →  trigger above 86  →  sustained 10s  →  qualified
```

with a valid GNSS fix required throughout. A brief GPS spike never creates an
event. The rule lives in `src/lib/rules/speed-rule.ts` and is visualised by
`src/components/telemetry/speed-rule.tsx`.

Telemetry, the rule and stored evidence are always in km/h — the device's native
unit. Imperial jurisdictions convert at the presentation boundary only.

---

## Design system

The full contract is in [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md). In short:

- **Dark graphite operational interface.** Light mode is available via
  `data-theme="light"` and re-points only the semantic token layer.
- **TerraLabs orange is brand, not status.** Orange marks selection, active
  state and focus. Status has its own independent scale: green / cyan / amber /
  red / magenta / grey. Tamper is magenta so a security event is never mistaken
  for a speed violation.
- **Two token layers.** A raw palette, then semantic aliases. Components only
  ever touch the semantic layer — no literal colours in components.
- **Mono is a signal.** Geist Mono marks anything that came off a device:
  measurements, identifiers, hashes, timestamps, coordinates.
- **Panels are hairlines, not shadows.** Elevation is reserved for surfaces that
  genuinely float.
- Contrast is verified against WCAG AA on every ground a token is used on.

### Key directories

```
src/lib/jurisdiction.ts          the jurisdiction/i18n domain layer
src/lib/status.ts                the single status vocabulary
src/lib/rules/speed-rule.ts      enforcement thresholds (do not change casually)
src/components/ui/               design-system primitives
src/components/layout/           shell: sidebar, top bar, palette, boot sequence
src/components/telemetry/        speed-rule visualisation
src/components/map/              operations map
src/components/violations/       evidence record + chain of custody
src/components/presenter/        demonstration console
src/components/pages/            the thirteen routes
```

---

## Routes

| Group | Route | Purpose |
|---|---|---|
| Command | `/dashboard` | situational awareness, live map, attention list |
| Command | `/live-vehicles` | fleet telemetry console, master/detail |
| Command | `/map-heatmap` | full-viewport operations map |
| Enforcement | `/violations` | evidence register + integrity inspection |
| Enforcement | `/challan-notices` | notice workflow, gated on verification |
| Enforcement | `/vehicle-search` | registry lookup |
| Fleet | `/device-health` | device fleet diagnostics |
| Fleet | `/tamper-events` | security incidents |
| Fleet | `/offline-devices` | offline-first queue and sync lifecycle |
| Fleet | `/fitment-centers` | installation and activation |
| Intelligence | `/analytics` | enforcement trend, compliance, reliability |
| Intelligence | `/audit-logs` | append-only trail |
| System | `/system-settings` | jurisdiction, policy, protocol, retention |

Global search is `⌘K` (or `/`), and searches vehicles, devices, violations and
destinations.

---

## Presenter mode

This build is a demonstration system. Demo controls are deliberately separated
from the operational UI: a permanently visible **DEMO** control in the top bar
opens the presenter console, which carries scenarios, a simulation-speed
multiplier and subsystem overrides. Every control in it calls a real store
action — nothing in the console does something the application cannot genuinely do.

Simulated regions are marked, the bridge reports whether it is in **mock** or
**live** BLE mode, and the jurisdiction is always labelled as a demonstration
jurisdiction.

---

## Protocols

- [`docs/PHYSICAL_BLUEBOX_PROTOCOL.md`](docs/PHYSICAL_BLUEBOX_PROTOCOL.md) — ESP32 BLE identity, UUIDs, state/event/health/ACK packets, reconnect behaviour
- [`docs/ANDROID_BLE_PROTOCOL.md`](docs/ANDROID_BLE_PROTOCOL.md) — Android peripheral service, telemetry framing, commands

All BLE constants are centralised in `src/lib/physical-bluebox-protocol.ts`.

---

## Notes

- Data is simulated and persisted in the browser with `localStorage`.
- No environment variables are required.
- Real Windows BLE requires a native adapter and Node build prerequisites; the
  mock bridge is fully runnable on any platform.

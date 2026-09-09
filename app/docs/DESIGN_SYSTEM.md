# BlueBox One — Design System

TerraLabs Industries · Connected Road Safety & Enforcement Infrastructure

This is the contract. Every screen is built from these primitives, and nothing
below is optional styling advice — a route that invents its own container,
colour or spacing breaks the product's coherence.

---

## 1. The one rule about colour

**TerraLabs orange is BRAND, not STATUS.**

Orange marks what the operator has *selected*, what is *active*, and what is
*ours*. It never means "warning". Status has its own independent scale.

| Token | Meaning | Where it appears |
|---|---|---|
| `--brand` | selection, active nav, focus, primary CTA, live marker | sparingly |
| `--ok` (green) | healthy, online, connected, verified, resolved | status only |
| `--info` (cyan) | processing, uploading, restoring, system info | status only |
| `--warn` (amber) | degraded, pending, review, near threshold | status only |
| `--crit` (red) | violation, critical, failure, rejected | status only |
| `--tamper` (magenta) | physical / firmware integrity event | status only |
| `--idle` (grey) | offline, unknown, not reporting, disabled | status only |

Tamper is magenta, deliberately: a security event must never be mistaken for a
speed violation, and neither may be mistaken for brand orange.

Never write a literal hex in a component. Use tokens.

---

## 2. Tokens

Two layers. Components may only touch the second.

- **Raw palette** — `--brand-500`, `--graphite`, `--red`… never used directly.
- **Semantic** — `--panel`, `--line`, `--text-2`, `--crit-dim`… the component API.

Light mode re-points only the semantic layer under `[data-theme="light"]`, which
is why no component needs to know it exists.

Key semantics:

```
Grounds     --chrome (rails/topbar, near-black) · --bg · --panel · --panel-header
            --panel-sunken (recess) · --panel-raised (popovers)
Hairlines   --line · --line-soft · --line-strong
Text        --text (primary) · --text-2 · --text-3 · --text-4 (faintest)
Radii       --r-xs 3 · --r-sm 4 · --r-md 6 · --r-lg 8      (never larger)
Motion      --t-fast 110ms · --t-base 160ms · --t-slow 240ms
Layout      --sidebar-w · --topbar-h · --sidebar-offset
```

---

## 3. Typography

Geist for the interface. **Geist Mono for anything that came off a device** —
measurements, identifiers, hashes, timestamps, coordinates, firmware versions.
That distinction is the whole typographic system: a reader can tell a
measurement from a description without reading either.

| Class | Use |
|---|---|
| `t-page-label` / `t-page-title` / `t-page-desc` | page header only |
| `t-section` | a labelled group of panels |
| `t-panel-title` | panel header |
| `t-label` | field caption, small caps |
| `t-body` / `t-meta` | running text |
| `t-num` | any number (tabular figures) |
| `t-metric` / `t-metric-lg` / `t-metric-xl` | instrument readouts (mono) |
| `t-mono` / `t-mono-sm` | identifiers, hashes, timestamps |
| `t-reg` | registration plates |

Nothing is marketing scale. The largest running type is a 19px page title.

---

## 4. Primitives

Import these. Do not re-implement them.

### Layout
```tsx
import { Page, PageHeader, PageBody, HeaderStat } from "@/components/ui/page-header";
import { Panel, PanelHead, PanelBody, Field, FieldGrid, Section } from "@/components/ui/panel";
```

Every route is:

```tsx
<Page>
  <PageHeader group={copy.group} title={copy.title} description={copy.description}
              status={<HeaderStat .../>} actions={<Button .../>} />
  <PageBody>…</PageBody>
</Page>
```

`<PageBody flush>` hands the whole area to the child (the map does this).

### Status
```tsx
import { StatusBadge, SeverityBadge, StatusDot, ConnectivityIndicator,
         VerificationState, DeviceStateIndicator, Meter } from "@/components/ui/status";
```

`StatusBadge` infers its tone from its own text via `toneOf()`. Pass `tone`
explicitly only when the label is ambiguous (e.g. `"Open"`).

### Data
```tsx
import { DataTable, IdentityCell, PlateCell, SpeedCell } from "@/components/ui/data-table";
import { MetricStrip, MetricStrip4, MetricCell, StatusHeadline, Readout } from "@/components/ui/metric";
import { Timeline, EventStream } from "@/components/ui/timeline";
```

### Controls & surfaces
```tsx
import { Button, LinkButton, Segmented } from "@/components/ui/button";
import { Input, Select, SearchField, LabelledField, SettingRow, ReadOnlyValue } from "@/components/ui/input";
import { Overlay, DetailPane } from "@/components/ui/drawer";
import { EmptyState, ConditionState, LoadingState } from "@/components/ui/states";
```

### Charts
```tsx
import { ChartFrame, Grid, AxisX, AxisY, BarTooltip, LineTooltip,
         AreaGradient, ChartLegend, SeriesReadout, Sparkline,
         chartColors, chartTheme } from "@/components/ui/chart-kit";
```

Charts use the semantic status palette. No rainbow scales, no per-chart colours.

### Domain
```tsx
import { SpeedRuleScale, QualificationProgress, SpeedReadout, RuleSummary, speedTone }
  from "@/components/telemetry/speed-rule";
import { useJurisdiction } from "@/lib/use-jurisdiction";
import { enforcementStateOf, triggerSpeedOf, canEnforce } from "@/lib/utils";
import { enforcementLabel, enforcementTone, levelTone, severityTone, toneOf } from "@/lib/status";
```

---

## 5. Jurisdiction — non-negotiable

**No component may hardcode** `KL`, `Kerala`, `Kochi`, `RTO`, `IST`, `km/h`,
`₹`, or `Challan`.

```tsx
const j = useJurisdiction();

j.speed(92)          // "92 km/h"  → "57 mph" in an imperial jurisdiction
j.speedValue(92)     // 92         → numeral only, for large readouts
j.speedUnitLabel     // "km/h"
j.time(iso)          // jurisdiction-local, zone-correct
j.date(iso) · j.dateTime(iso) · j.precise(iso)
j.currency(500) · j.number(12482) · j.distance(km)
j.label              // "Kerala, India"
j.noticeTerm         // "Traffic Challan" — the LOCAL word for a notice
j.registrationExample · j.registrationFormat
j.environment        // "Demonstration" — always show this
```

Navigation and headings say **"Notices"**. The jurisdiction's local term
(`j.noticeTerm`) appears only where the notice itself is described.

Telemetry, the speed rule and stored evidence stay in km/h — the device's
native unit. Imperial jurisdictions convert **at display only**.

---

## 6. Density and layout

Desktop first: 1366×768 must show real content; 1440 and 1920 are the targets.

- Page body padding `p-3.5` (14px). Gaps between panels `gap-3` (12px).
- Panel header 36px. Table rows 28px compact / 34px relaxed.
- **Never** `space-y-16`+ between sections. Never a full-width hero.
- Prefer one dense panel over three sparse cards.
- Tables scroll inside their own container; the page does not scroll sideways.
- Below `lg` the sidebar becomes a sheet; detail panes become drawers.

---

## 7. Elevation, radius, motion

- Panels are defined by a **1px hairline**, never a shadow.
- Shadows only for things that genuinely float: popovers, drawers, modals, map controls.
- Radii 3–8px. Never a pill on a container.
- Transitions 110–240ms, colour and position only. No bounce, no scale, no glow.
- `.a-urgent` (pulse) is reserved for the qualification countdown. Nothing else pulses continuously.
- `.dot-live` marks state that is genuinely updating.

---

## 8. States

Every table and list needs a real empty state naming the condition:

```tsx
<EmptyState icon={<Icon className="h-4 w-4" />} title="No devices offline"
            description="Every device currently has a network route." />
```

Use `ConditionState` for a named operating condition (bridge down, tiles
unavailable) — it carries a status edge because the condition *is* information.

---

## 9. Accessibility

- Real semantic HTML. Tables are `<table>`. Toggles carry `aria-pressed`.
- Colour is never the only channel: every status dot has an adjacent text label.
- Focus is visible everywhere (brand outline, defined globally).
- `prefers-reduced-motion` is honoured in `globals.css` — do not add un-guarded infinite animations.

---

## 10. Copy

Operational, never marketing.

| Instead of | Write |
|---|---|
| "Welcome back! Here's what's happening" | "Road Safety Operations" |
| "Your Devices" | "Device Fleet" |
| "Kerala RTO Command Center" | "Road Safety Command Center" + jurisdiction line |
| "Amazing insights" | "Enforcement trend" |

Never claim the device decides a penalty. The architecture is:

```
DEVICE (detect · qualify · sign) → EVIDENCE → BACKEND VERIFICATION → ENFORCEMENT POLICY
```

Only map states the application genuinely has. Do not invent verification
results, and do not label simulated data as live.

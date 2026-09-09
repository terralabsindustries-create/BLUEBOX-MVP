"use client";

import { Line, LineChart, ResponsiveContainer } from "recharts";
import { Printer } from "lucide-react";
import { Page, PageBody, PageHeader, HeaderStat } from "@/components/ui/page-header";
import { Panel, PanelBody, Section } from "@/components/ui/panel";
import { MetricCell, MetricStrip, Readout } from "@/components/ui/metric";
import { Button } from "@/components/ui/button";
import {
  AxisX,
  AxisY,
  ChartFrame,
  ChartLegend,
  Grid,
  LineTooltip,
  chartColors,
  chartTheme,
} from "@/components/ui/chart-kit";
import {
  DeviceStatusChart,
  SeverityDistributionChart,
  SpeedComplianceChart,
  TopLocationsPanel,
  ViolationTrendChart,
} from "@/components/panels/charts";
import { copyFor } from "@/components/layout/nav-config";
import { useSimulationStore } from "@/store/simulation-store";
import { useJurisdiction } from "@/lib/use-jurisdiction";

/**
 * Weekly incident profile. Illustrative, and captioned as such — the seeded
 * dataset covers a short window, so plotting it as a week would misrepresent
 * the deployment's actual recorded history.
 */
const INCIDENT_WEEK = [
  { day: "Mon", tamper: 5, outage: 11 },
  { day: "Tue", tamper: 7, outage: 13 },
  { day: "Wed", tamper: 4, outage: 8 },
  { day: "Thu", tamper: 8, outage: 16 },
  { day: "Fri", tamper: 6, outage: 12 },
  { day: "Sat", tamper: 3, outage: 9 },
  { day: "Sun", tamper: 2, outage: 6 },
];

/**
 * ANALYTICS
 *
 * Structured by question rather than by chart type, and deliberately unequal:
 * the enforcement trend is the lead and gets width and height; everything else
 * supports it. A page of identically sized plots tells a reader that every
 * measure matters the same amount, which is never true.
 */
export function AnalyticsPage() {
  const copy = copyFor("/analytics");
  const j = useJurisdiction();
  const violations = useSimulationStore((state) => state.violations);
  const metrics = useSimulationStore((state) => state.metrics);
  const tamperEvents = useSimulationStore((state) => state.tamperEvents);

  const verified = violations.filter((item) => item.backendVerification === "PASSED").length;
  const offlineSigned = violations.filter((item) => item.networkStatusAtEvent === "OFFLINE_AT_EVENT").length;

  return (
    <Page>
      <PageHeader
        group={copy.group}
        title={copy.title}
        description={copy.description}
        status={
          <>
            <HeaderStat label="Records" value={j.number(violations.length)} />
            <HeaderStat label="Verified" value={j.number(verified)} tone="ok" />
            <HeaderStat label="Incidents" value={j.number(tamperEvents.length)} />
          </>
        }
        actions={
          <Button size="sm" variant="secondary" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" />
            Print report
          </Button>
        }
      />

      <PageBody>
        {/* 1 — The lead measure. */}
        <Section title="Enforcement trend" description="When qualified violations occur across the day">
          <div className="grid gap-3 xl:grid-cols-[1.9fr_1fr]">
            <ViolationTrendChart height={230} />
            <Panel>
              <PanelBody pad="md" className="flex h-full flex-col justify-center gap-4">
                <Readout label="Records held" value={j.number(violations.length)} size="lg" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <Readout label="Backend verified" value={j.number(verified)} tone="ok" />
                  <Readout label="Signed offline" value={j.number(offlineSigned)} tone="info" />
                  <Readout label="Violations today" value={j.number(metrics.violationsToday)} tone="crit" />
                  <Readout label="Notices today" value={metrics.noticesToday} />
                </div>
                <p className="t-meta border-t border-[var(--line-soft)] pt-3 leading-snug">
                  Every record counted here cleared the tolerance and sustain thresholds locally before it was signed.
                  Brief speed spikes are discarded on the device and never reach this figure.
                </p>
              </PanelBody>
            </Panel>
          </div>
        </Section>

        {/* 2 — Compliance. */}
        <Section title="Speed compliance" description="Where the tracked fleet sits against the rule right now">
          <SpeedComplianceChart height={210} />
        </Section>

        {/* 3 — Severity and geography. */}
        <Section title="Severity and geographic risk">
          <div className="grid gap-3 lg:grid-cols-2">
            <SeverityDistributionChart height={200} />
            <TopLocationsPanel limit={6} />
          </div>
        </Section>

        {/* 4 — Reliability. */}
        <Section title="Device reliability" description="Fleet composition and the two independent failure modes">
          <div className="grid gap-3 lg:grid-cols-2">
            <DeviceStatusChart />
            <ChartFrame
              title="Integrity incidents"
              caption="Illustrative weekly profile — not recorded history"
              height={200}
              aside={
                <ChartLegend
                  items={[
                    { label: "Tamper", color: chartColors.tamper },
                    { label: "Network outage", color: chartColors.info },
                  ]}
                />
              }
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={INCIDENT_WEEK} margin={{ top: 6, right: 10, bottom: 0, left: -4 }}>
                  <Grid />
                  <AxisX dataKey="day" />
                  <AxisY width={42} allowDecimals={false} />
                  <LineTooltip unit="events" />
                  <Line
                    type="monotone"
                    dataKey="tamper"
                    name="Tamper"
                    stroke={chartColors.tamper}
                    strokeWidth={1.8}
                    dot={{ r: 2.5, fill: chartColors.tamper, strokeWidth: 0 }}
                    activeDot={{ r: 4, stroke: chartTheme.surface, strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="outage"
                    name="Network outage"
                    stroke={chartColors.info}
                    strokeWidth={1.8}
                    dot={{ r: 2.5, fill: chartColors.info, strokeWidth: 0 }}
                    activeDot={{ r: 4, stroke: chartTheme.surface, strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartFrame>
          </div>
        </Section>

        {/* 5 — Headline figures. */}
        <Section title="Deployment summary">
          <MetricStrip>
            <MetricCell label="Device uptime" value="99.82%" caption="Rolling 24-hour average" tone="ok" />
            <MetricCell label="GNSS quality" value="96.4%" caption="Fixes passing the quality gate" tone="ok" />
            <MetricCell label="Repeat offenders" value="48" caption="Vehicles flagged more than once" tone="warn" />
            <MetricCell label="Fitment progress" value="92.7%" caption="Registry mapped to a device" />
            <MetricCell label="Within thresholds" value="88.3%" caption="Compliant across the period" tone="ok" />
            <MetricCell
              label="Vehicles protected"
              value={metrics.totalVehiclesProtected}
              caption="Cumulative across the deployment"
            />
          </MetricStrip>
        </Section>
      </PageBody>
    </Page>
  );
}

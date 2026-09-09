"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { Page, PageBody, PageHeader, HeaderStat } from "@/components/ui/page-header";
import { Field, FieldGrid } from "@/components/ui/panel";
import { Button, LinkButton } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status";
import { SpeedReadout } from "@/components/telemetry/speed-rule";
import { OperationsMap, type MapLayer } from "@/components/map/operations-map";
import { copyFor } from "@/components/layout/nav-config";
import { useSimulationStore } from "@/store/simulation-store";
import { useJurisdiction } from "@/lib/use-jurisdiction";
import { type EnforcementState, enforcementLabel, enforcementTone } from "@/lib/status";
import { elapsedSince, enforcementStateOf, formatCoords } from "@/lib/utils";

/**
 * THE MAP ROUTE
 *
 * Here the map is not a panel on a page — it is the page. Everything else
 * floats over it: filters and layers come from the map's own controls, and the
 * selected record is a card anchored to a corner rather than a column that
 * would steal half the viewport from the thing the operator came to look at.
 */
export function MapHeatmapPage() {
  const copy = copyFor("/map-heatmap");
  const j = useJurisdiction();
  const [layer, setLayer] = useState<MapLayer>("all");
  const [cardOpen, setCardOpen] = useState(true);

  const now = useSimulationStore((state) => state.now);
  const vehicles = useSimulationStore((state) => state.vehicles);
  const selectedVehicleId = useSimulationStore((state) => state.selectedVehicleId);
  const selectVehicle = useSimulationStore((state) => state.selectVehicle);

  const counts = useMemo(() => {
    const result: Record<EnforcementState, number> = {
      normal: 0,
      near: 0,
      overspeed: 0,
      violation: 0,
      offline: 0,
      tamper: 0,
    };
    for (const vehicle of vehicles) result[enforcementStateOf(vehicle)] += 1;
    return result;
  }, [vehicles]);

  const selected = vehicles.find((vehicle) => vehicle.id === selectedVehicleId);
  const selectedState = selected ? enforcementStateOf(selected) : null;

  return (
    <Page>
      <PageHeader
        group={copy.group}
        title={copy.title}
        description={copy.description}
        status={
          <>
            <HeaderStat label="Plotted" value={j.number(vehicles.length)} />
            <HeaderStat label="Overspeed" value={j.number(counts.overspeed)} tone={counts.overspeed > 0 ? "crit" : "ok"} />
            <HeaderStat label="Tamper" value={j.number(counts.tamper)} tone={counts.tamper > 0 ? "crit" : "ok"} />
            <HeaderStat label="Offline" value={j.number(counts.offline)} tone={counts.offline > 0 ? "warn" : "ok"} />
          </>
        }
      />

      <PageBody flush>
        <OperationsMap
          layer={layer}
          onLayerChange={setLayer}
          className="h-full"
          overlay={
            selected && cardOpen ? (
              <div className="pointer-events-auto absolute bottom-11 right-2.5 z-[var(--z-map-control)] w-[290px] rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-float)]">
                <div className="flex items-start justify-between gap-2 border-b border-[var(--line)] px-3 py-2">
                  <div className="min-w-0">
                    <p className="t-reg truncate">{selected.registrationNumber}</p>
                    <p className="t-mono-sm mt-0.5 truncate text-[var(--text-4)]">{selected.device.id}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {selectedState ? (
                      <StatusBadge tone={enforcementTone[selectedState]} solid={selectedState === "tamper"}>
                        {enforcementLabel[selectedState]}
                      </StatusBadge>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setCardOpen(false)}
                      aria-label="Dismiss vehicle card"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="px-3 py-2.5">
                  {/* An offline device is not reporting, so its last stored
                      reading must never be presented as a live one. */}
                  {selectedState === "offline" ? (
                    <div>
                      <p className="t-label">Last known speed</p>
                      <p className="mt-1 flex items-baseline gap-1.5">
                        <span className="t-metric text-[var(--idle-text)]">
                          {j.speedValue(selected.telemetry.speed)}
                        </span>
                        <span className="t-mono-sm font-semibold uppercase tracking-[0.08em] text-[var(--text-4)]">
                          {j.speedUnitLabel}
                        </span>
                      </p>
                      <p className="t-mono-sm mt-1 text-[var(--text-4)]">Not currently reporting</p>
                    </div>
                  ) : (
                    <SpeedReadout
                      speed={selected.telemetry.speed}
                      limit={selected.telemetry.roadLimit}
                      tolerance={selected.telemetry.tolerance}
                      size="md"
                    />
                  )}

                  <FieldGrid columns={2} className="mt-3">
                    <Field label="Road" value={selected.telemetry.roadName} />
                    <Field label="District" value={selected.telemetry.district} />
                    <Field label="Coordinates" value={formatCoords(selected.telemetry.coordinates)} mono />
                    <Field
                      label="Last signal"
                      value={elapsedSince(selected.telemetry.heartbeatAt, now)}
                      mono
                    />
                  </FieldGrid>

                  <LinkButton
                    href="/live-vehicles"
                    size="xs"
                    variant="secondary"
                    className="mt-3 w-full"
                    onClick={() => selectVehicle(selected.id)}
                  >
                    Open in Live Operations
                    <ArrowUpRight className="h-3 w-3" />
                  </LinkButton>
                </div>
              </div>
            ) : selected && !cardOpen ? (
              <Button
                variant="secondary"
                size="xs"
                onClick={() => setCardOpen(true)}
                className="pointer-events-auto absolute bottom-11 right-2.5 z-[var(--z-map-control)]"
              >
                {selected.registrationNumber}
              </Button>
            ) : null
          }
        />
      </PageBody>
    </Page>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Radar, SearchX } from "lucide-react";
import { Page, PageBody, PageHeader, HeaderStat } from "@/components/ui/page-header";
import { Panel, PanelHead } from "@/components/ui/panel";
import { DataTable, IdentityCell, SpeedCell } from "@/components/ui/data-table";
import { Button, Segmented } from "@/components/ui/button";
import { SearchField } from "@/components/ui/input";
import { StatusBadge, StatusDot } from "@/components/ui/status";
import { EmptyState } from "@/components/ui/states";
import { Overlay } from "@/components/ui/drawer";
import { VehicleDetail } from "@/components/fleet/vehicle-detail";
import { copyFor } from "@/components/layout/nav-config";
import { useSimulationStore } from "@/store/simulation-store";
import { useJurisdiction } from "@/lib/use-jurisdiction";
import { normalisePlate } from "@/lib/jurisdiction";
import { type EnforcementState, enforcementLabel, enforcementTone, toneOf } from "@/lib/status";
import { elapsedSince, enforcementStateOf } from "@/lib/utils";

type Filter = EnforcementState | "all";

/**
 * FLEET TELEMETRY CONSOLE
 *
 * Master–detail, because the question an operator actually has is never "show
 * me one vehicle" — it is "show me which of these vehicles matters, then tell
 * me everything about that one". A modal would hide the fleet at exactly the
 * moment they are comparing across it, so above 1280px the record docks beside
 * the table and only becomes a drawer when there is genuinely no room.
 */
export function LiveVehiclesPage() {
  const copy = copyFor("/live-vehicles");
  const j = useJurisdiction();
  const now = useSimulationStore((state) => state.now);
  const vehicles = useSimulationStore((state) => state.vehicles);
  const selectedVehicleId = useSimulationStore((state) => state.selectedVehicleId);
  const selectVehicle = useSimulationStore((state) => state.selectVehicle);

  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const rows = useMemo(
    () => vehicles.map((vehicle) => ({ vehicle, state: enforcementStateOf(vehicle) })),
    [vehicles],
  );

  const counts = useMemo(() => {
    const result: Record<Filter, number> = {
      all: rows.length,
      normal: 0,
      near: 0,
      overspeed: 0,
      violation: 0,
      offline: 0,
      tamper: 0,
    };
    for (const row of rows) result[row.state] += 1;
    return result;
  }, [rows]);

  const filtered = useMemo(() => {
    const plate = normalisePlate(query);
    const term = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== "all" && row.state !== filter) return false;
      if (!term) return true;
      // Plates are stored spaced but searched unspaced as often as not, so both
      // sides are normalised before comparison.
      return (
        normalisePlate(row.vehicle.registrationNumber).includes(plate) ||
        row.vehicle.device.id.toLowerCase().includes(term) ||
        row.vehicle.ownerName.toLowerCase().includes(term)
      );
    });
  }, [rows, filter, query]);

  const inMotion = rows.filter((row) => row.vehicle.telemetry.speed > 5).length;

  const openVehicle = (id: string) => {
    selectVehicle(id);
    setDrawerOpen(true);
  };

  return (
    <Page>
      <PageHeader
        group={copy.group}
        title={copy.title}
        description={copy.description}
        status={
          <>
            <HeaderStat label="Tracked" value={j.number(rows.length)} />
            <HeaderStat label="In motion" value={j.number(inMotion)} />
            <HeaderStat
              label="Over trigger"
              value={j.number(counts.overspeed)}
              tone={counts.overspeed > 0 ? "crit" : "ok"}
            />
            <HeaderStat label="Offline" value={j.number(counts.offline)} tone={counts.offline > 0 ? "warn" : "ok"} />
          </>
        }
      />

      <PageBody className="flex flex-col gap-3 overflow-hidden p-3.5">
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder={`Registration, device or owner — e.g. ${j.registrationExample}`}
            className="w-full max-w-xs"
            aria-label="Filter vehicles"
          />
          <Segmented<Filter>
            ariaLabel="Filter by enforcement state"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All", count: counts.all },
              { value: "normal", label: "Normal", count: counts.normal },
              { value: "near", label: "Near limit", count: counts.near },
              { value: "overspeed", label: "Overspeed", count: counts.overspeed },
              { value: "offline", label: "Offline", count: counts.offline },
              { value: "tamper", label: "Tamper", count: counts.tamper },
            ]}
          />
          <span className="t-meta ml-auto">
            {j.number(filtered.length)} of {j.number(rows.length)} vehicles
          </span>
        </div>

        <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Panel className="min-h-0">
            <PanelHead
              title="Fleet"
              meta={filter === "all" ? undefined : enforcementLabel[filter as EnforcementState]}
              icon={<Radar className="h-3.5 w-3.5" />}
            />
            <DataTable
              caption="Live vehicle telemetry"
              rows={filtered}
              rowKey={(row) => row.vehicle.id}
              onRowClick={(row) => openVehicle(row.vehicle.id)}
              selectedKey={selectedVehicleId}
              severityOf={(row) =>
                row.state === "tamper" ? "tamper" : row.state === "overspeed" ? "crit" : row.state === "near" ? "warn" : undefined
              }
              className="min-h-0 flex-1"
              emptyState={
                <EmptyState
                  icon={<SearchX className="h-4 w-4" />}
                  title="No vehicles match"
                  description={
                    query
                      ? `Nothing in the fleet matches “${query}” in this state.`
                      : "No vehicle is currently in this state."
                  }
                  action={
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setFilter("all");
                        setQuery("");
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              }
              columns={[
                {
                  key: "vehicle",
                  header: "Vehicle",
                  sortBy: (row) => row.vehicle.registrationNumber,
                  render: (row) => (
                    <IdentityCell title={row.vehicle.registrationNumber} subtitle={row.vehicle.ownerName} />
                  ),
                },
                {
                  key: "device",
                  header: "Device",
                  variant: "mono",
                  hideBelow: "lg",
                  sortBy: (row) => row.vehicle.device.id,
                  render: (row) => row.vehicle.device.id,
                },
                {
                  key: "speed",
                  header: `Speed / limit`,
                  variant: "num",
                  sortBy: (row) => row.vehicle.telemetry.speed,
                  render: (row) =>
                    row.state === "offline" ? (
                      <span className="t-mono-sm text-[var(--text-4)]">—</span>
                    ) : (
                      <SpeedCell
                        speed={row.vehicle.telemetry.speed}
                        limit={row.vehicle.telemetry.roadLimit}
                        tolerance={row.vehicle.telemetry.tolerance}
                      />
                    ),
                },
                {
                  key: "road",
                  header: "Location",
                  hideBelow: "md",
                  sortBy: (row) => row.vehicle.telemetry.roadName,
                  render: (row) => <span className="t-meta">{row.vehicle.telemetry.roadName}</span>,
                },
                {
                  key: "gnss",
                  header: "GNSS",
                  hideBelow: "xl",
                  render: (row) => (
                    <span className="flex items-center gap-1.5">
                      <StatusDot tone={toneOf(row.vehicle.telemetry.gps.state)} />
                      <span className="t-mono-sm text-[var(--text-3)]">
                        {row.vehicle.telemetry.gps.satellites} sats
                      </span>
                    </span>
                  ),
                },
                {
                  key: "signal",
                  header: "Last signal",
                  hideBelow: "lg",
                  sortBy: (row) => row.vehicle.telemetry.heartbeatAt,
                  render: (row) => (
                    <span className="t-mono-sm text-[var(--text-3)]">
                      {elapsedSince(row.vehicle.telemetry.heartbeatAt, now)}
                    </span>
                  ),
                },
                {
                  key: "state",
                  header: "State",
                  sortBy: (row) => row.state,
                  render: (row) => (
                    <StatusBadge
                      tone={enforcementTone[row.state]}
                      solid={row.state === "tamper"}
                      dot
                      live={row.state === "overspeed"}
                    >
                      {enforcementLabel[row.state]}
                    </StatusBadge>
                  ),
                },
              ]}
            />
          </Panel>

          {/* Docked record on wide displays. */}
          <VehicleDetail vehicleId={selectedVehicleId} className="hidden min-h-0 xl:flex" />
        </div>
      </PageBody>

      {/* Below xl the same record becomes a drawer rather than being cut off. */}
      <Overlay
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        eyebrow="Vehicle"
        title="Live telemetry"
        width="max-w-[440px]"
        className="xl:hidden"
      >
        <VehicleDetail vehicleId={selectedVehicleId} className="border-0" />
      </Overlay>
    </Page>
  );
}

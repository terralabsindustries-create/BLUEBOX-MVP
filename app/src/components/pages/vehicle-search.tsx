"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Activity, MapPin, Search, SearchX, ShieldCheck, TriangleAlert } from "lucide-react";
import { Page, PageBody, PageHeader, HeaderStat } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHead, Field, FieldGrid } from "@/components/ui/panel";
import { Button, LinkButton } from "@/components/ui/button";
import { SearchField } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status";
import { EmptyState } from "@/components/ui/states";
import { copyFor } from "@/components/layout/nav-config";
import { useSimulationStore } from "@/store/simulation-store";
import { useJurisdiction } from "@/lib/use-jurisdiction";
import { normalisePlate } from "@/lib/jurisdiction";
import { enforcementLabel, enforcementTone, toneOf } from "@/lib/status";
import { elapsedSince, enforcementStateOf } from "@/lib/utils";

const RESULT_LIMIT = 10;

/**
 * REGISTRY LOOKUP
 *
 * Optimised for the one thing it is used for: an officer has a plate — read off
 * a screen, a radio, or a windscreen — and needs the record now. Plates are
 * normalised on both sides, so `KL07AB1289`, `kl 07 ab 1289` and `07ab` all
 * reach the same vehicle regardless of how the jurisdiction spaces its format.
 *
 * Results are structured entity records, not generic cards: an operator scans
 * them for a specific field, so the fields sit in fixed positions.
 */
export function VehicleSearchPage() {
  const copy = copyFor("/vehicle-search");
  const j = useJurisdiction();
  const router = useRouter();
  const now = useSimulationStore((state) => state.now);
  const vehicles = useSimulationStore((state) => state.vehicles);
  const violations = useSimulationStore((state) => state.violations);
  const search = useSimulationStore((state) => state.vehicleSearch);
  const setSearch = useSimulationStore((state) => state.setVehicleSearch);
  const selectVehicle = useSimulationStore((state) => state.selectVehicle);

  const query = search.trim();

  const results = useMemo(() => {
    if (!query) return [];
    const plate = normalisePlate(query);
    const term = query.toLowerCase();
    return vehicles.filter(
      (vehicle) =>
        normalisePlate(vehicle.registrationNumber).includes(plate) ||
        vehicle.device.id.toLowerCase().includes(term) ||
        vehicle.device.serial.toLowerCase().includes(term) ||
        vehicle.ownerName.toLowerCase().includes(term) ||
        vehicle.chassisReference.toLowerCase().includes(term),
    );
  }, [vehicles, query]);

  const violationCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const violation of violations) {
      counts.set(violation.registrationNumber, (counts.get(violation.registrationNumber) ?? 0) + 1);
    }
    return counts;
  }, [violations]);

  const openTelemetry = (id: string) => {
    selectVehicle(id);
    router.push("/live-vehicles");
  };

  return (
    <Page>
      <PageHeader
        group={copy.group}
        title={copy.title}
        description={copy.description}
        status={
          <>
            <HeaderStat label="Registry" value={j.number(vehicles.length)} />
            <HeaderStat label="Matches" value={query ? j.number(results.length) : "—"} />
          </>
        }
      />

      <PageBody>
        <div className="max-w-2xl">
          <SearchField
            size="lg"
            value={search}
            onChange={setSearch}
            placeholder={`Registration, device, owner or chassis — e.g. ${j.registrationExample}`}
            aria-label="Search the vehicle registry"
          />
          <p className="t-meta mt-1.5">
            Format <span className="t-mono text-[var(--text-2)]">{j.registrationFormat}</span> · spacing is ignored ·
            also matches device ID, serial, owner and chassis reference
          </p>
        </div>

        {!query ? (
          <Panel>
            <EmptyState
              icon={<Search className="h-4 w-4" />}
              title="Search the registry"
              description={`${j.number(vehicles.length)} vehicles are mapped to a device in this deployment. Enter a registration, device ID, owner name or chassis reference to retrieve a record.`}
              action={
                <div className="flex flex-wrap justify-center gap-1.5">
                  {vehicles.slice(0, 3).map((vehicle) => (
                    <Button
                      key={vehicle.id}
                      size="xs"
                      variant="secondary"
                      onClick={() => setSearch(vehicle.registrationNumber)}
                    >
                      <span className="t-mono">{vehicle.registrationNumber}</span>
                    </Button>
                  ))}
                </div>
              }
            />
          </Panel>
        ) : results.length === 0 ? (
          <Panel>
            <EmptyState
              icon={<SearchX className="h-4 w-4" />}
              title="No record matches"
              description={`Nothing in the registry matches “${query}”. Check the registration format or search by device ID.`}
              action={
                <Button size="sm" variant="secondary" onClick={() => setSearch("")}>
                  Clear search
                </Button>
              }
            />
          </Panel>
        ) : (
          <>
            {results.length > RESULT_LIMIT ? (
              <p className="t-meta">
                Showing {RESULT_LIMIT} of {j.number(results.length)} matches. Refine the query to narrow the result set.
              </p>
            ) : null}

            <div className="grid gap-3 2xl:grid-cols-2">
              {results.slice(0, RESULT_LIMIT).map((vehicle) => {
                const state = enforcementStateOf(vehicle);
                const { telemetry, device } = vehicle;
                return (
                  <Panel key={vehicle.id}>
                    <PanelHead
                      title={<span className="t-reg text-[13px]">{vehicle.registrationNumber}</span>}
                      meta={`${vehicle.vehicleType} · ${vehicle.category}`}
                      actions={
                        <StatusBadge tone={enforcementTone[state]} solid={state === "tamper"} dot>
                          {enforcementLabel[state]}
                        </StatusBadge>
                      }
                    />
                    <PanelBody pad="md">
                      <FieldGrid columns={4}>
                        <Field label="BlueBox device" value={device.id} mono />
                        <Field label="Owner" value={vehicle.ownerName} />
                        <Field
                          label="Current speed"
                          value={state === "offline" ? "—" : j.speed(telemetry.speed)}
                          mono
                          tone={state === "overspeed" ? "crit" : state === "near" ? "warn" : undefined}
                        />
                        <Field label="Last seen" value={elapsedSince(telemetry.heartbeatAt, now)} mono />

                        <Field
                          label="Violations"
                          value={j.number(violationCount.get(vehicle.registrationNumber) ?? 0)}
                          tone={(violationCount.get(vehicle.registrationNumber) ?? 0) > 0 ? "warn" : undefined}
                        />
                        <Field
                          label="Device health"
                          value={telemetry.gps.accuracy}
                          mono
                          tone={toneOf(telemetry.gps.accuracy)}
                        />
                        <Field label="Serial" value={device.serial} mono />
                        <Field label="Service status" value={vehicle.serviceStatus} tone={toneOf(vehicle.serviceStatus)} />

                        <Field label="Chassis" value={vehicle.chassisReference} mono />
                        <Field label="Certificate" value={vehicle.certificateRef} mono />
                        <Field label="Fitment centre" value={device.fitmentCenterId} mono />
                        <Field label="Firmware" value={device.firmware} mono />
                      </FieldGrid>

                      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[var(--line-soft)] pt-3">
                        <Button size="xs" variant="secondary" onClick={() => openTelemetry(vehicle.id)}>
                          <Activity className="h-3 w-3" />
                          Live telemetry
                        </Button>
                        <LinkButton href="/violations" size="xs" variant="secondary">
                          <TriangleAlert className="h-3 w-3" />
                          Violations
                        </LinkButton>
                        <Button
                          size="xs"
                          variant="secondary"
                          onClick={() => {
                            selectVehicle(vehicle.id);
                            router.push("/map-heatmap");
                          }}
                        >
                          <MapPin className="h-3 w-3" />
                          Location
                        </Button>
                        <LinkButton href="/device-health" size="xs" variant="secondary">
                          <ShieldCheck className="h-3 w-3" />
                          Device
                        </LinkButton>
                      </div>
                    </PanelBody>
                  </Panel>
                );
              })}
            </div>
          </>
        )}
      </PageBody>
    </Page>
  );
}

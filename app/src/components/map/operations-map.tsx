"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Flame, Layers, Maximize2, Minimize2 } from "lucide-react";
import type { MapMarker } from "@/components/map/leaflet-map";
import { LoadingState } from "@/components/ui/states";
import { StatusDot } from "@/components/ui/status";
import { useSimulationStore } from "@/store/simulation-store";
import { useJurisdiction } from "@/lib/use-jurisdiction";
import { type EnforcementState, enforcementLabel, enforcementRank, enforcementTone } from "@/lib/status";
import { cn, enforcementStateOf } from "@/lib/utils";

const LeafletMap = dynamic(() => import("@/components/map/leaflet-map").then((module) => module.LeafletMap), {
  ssr: false,
  loading: () => <LoadingState label="Loading spatial surface" />,
});

export type MapLayer = EnforcementState | "all";

export const MAP_LAYERS: { value: MapLayer; label: string }[] = [
  { value: "all", label: "All" },
  { value: "normal", label: "Normal" },
  { value: "near", label: "Near limit" },
  { value: "overspeed", label: "Overspeed" },
  { value: "tamper", label: "Tamper" },
  { value: "offline", label: "Offline" },
];

/**
 * THE OPERATIONS MAP
 *
 * Treated as a primary product surface, not another dashboard widget: the map
 * fills its container and every control floats *over* the plot rather than
 * stealing vertical space around it. On the Map route it is the whole page.
 *
 * Controls sit in three corners by purpose — filters top-left (what am I
 * looking at), layers top-right (how am I looking at it), legend bottom-left
 * (what am I seeing). The selected-vehicle panel is the caller's business, so
 * the same map serves the Overview, Live Operations and the Map route.
 */
export function OperationsMap({
  layer = "all",
  onLayerChange,
  showControls = true,
  overlay,
  className,
}: Readonly<{
  layer?: MapLayer;
  onLayerChange?: (layer: MapLayer) => void;
  showControls?: boolean;
  /** Rendered above the map — a selected-entity card, a filter bar. */
  overlay?: React.ReactNode;
  className?: string;
}>) {
  const j = useJurisdiction();
  const vehicles = useSimulationStore((state) => state.vehicles);
  const selectedVehicleId = useSimulationStore((state) => state.selectedVehicleId);
  const selectVehicle = useSimulationStore((state) => state.selectVehicle);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const allMarkers = useMemo<MapMarker[]>(
    () =>
      vehicles.slice(0, 40).map((vehicle) => ({
        id: vehicle.id,
        registrationNumber: vehicle.registrationNumber,
        coords: vehicle.telemetry.coordinates,
        speed: vehicle.telemetry.speed,
        limit: vehicle.telemetry.roadLimit,
        road: vehicle.telemetry.roadName,
        device: vehicle.device.id,
        state: enforcementStateOf(vehicle),
      })),
    [vehicles],
  );

  const markers = useMemo(() => {
    const filtered = layer === "all" ? allMarkers : allMarkers.filter((marker) => marker.state === layer);
    // Draw the most urgent last so it paints on top of routine traffic.
    return [...filtered].sort((a, b) => enforcementRank[a.state] - enforcementRank[b.state]);
  }, [allMarkers, layer]);

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: allMarkers.length };
    for (const marker of allMarkers) result[marker.state] = (result[marker.state] ?? 0) + 1;
    return result;
  }, [allMarkers]);

  return (
    <div
      className={cn(
        // `isolate` keeps the high z-indices the floating controls need (Leaflet
        // reserves up to 1000 internally) from competing with the app chrome.
        "relative isolate min-h-0 overflow-hidden bg-[var(--panel-sunken)]",
        fullscreen ? "fixed inset-0 z-[var(--z-overlay)]" : "h-full w-full",
        className,
      )}
    >
      <LeafletMap
        markers={markers}
        selectedVehicleId={selectedVehicleId}
        onSelect={selectVehicle}
        showHeatmap={showHeatmap}
        center={j.center}
        zoom={j.zoom}
        speedUnit={j.speedUnitLabel}
        convert={j.speedRaw}
      />

      {showControls ? (
        <>
          {/* Top-left — what am I looking at. */}
          {onLayerChange ? (
            <div className="pointer-events-auto absolute left-2.5 top-2.5 z-[var(--z-map-control)] flex flex-wrap gap-1 rounded-[var(--r-sm)] border border-[var(--line)] bg-[rgba(9,11,13,0.9)] p-1 backdrop-blur-sm">
              {MAP_LAYERS.map((item) => {
                const active = layer === item.value;
                const count = counts[item.value] ?? 0;
                return (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onLayerChange(item.value)}
                    className={cn(
                      "flex h-6 items-center gap-1.5 rounded-[var(--r-xs)] px-2 text-[11px] transition-colors duration-[var(--t-fast)]",
                      active
                        ? "bg-[var(--brand)] font-semibold text-[var(--brand-on)]"
                        : "text-[var(--text-3)] hover:bg-[var(--chrome-hover)] hover:text-[var(--text)]",
                    )}
                  >
                    {item.value !== "all" ? (
                      <StatusDot tone={enforcementTone[item.value as EnforcementState]} />
                    ) : null}
                    {item.label}
                    <span className={cn("t-num text-[10px]", active ? "opacity-80" : "text-[var(--text-4)]")}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* Top-right — how am I looking at it. */}
          <div className="pointer-events-auto absolute right-2.5 top-2.5 z-[var(--z-map-control)] flex gap-1 rounded-[var(--r-sm)] border border-[var(--line)] bg-[rgba(9,11,13,0.9)] p-1 backdrop-blur-sm">
            <MapControl
              active={showHeatmap}
              onClick={() => setShowHeatmap((value) => !value)}
              label="Heatmap"
              icon={<Flame className="h-3.5 w-3.5" />}
            />
            <MapControl
              active={fullscreen}
              onClick={() => setFullscreen((value) => !value)}
              label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
              icon={fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              iconOnly
            />
          </div>

          {/* Bottom-left — what am I seeing. */}
          <div className="pointer-events-none absolute bottom-2.5 left-2.5 z-[var(--z-map-control)] flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--r-sm)] border border-[var(--line)] bg-[rgba(9,11,13,0.9)] px-2 py-1.5 backdrop-blur-sm">
            <Layers aria-hidden className="h-3 w-3 text-[var(--text-4)]" />
            {(["normal", "near", "overspeed", "tamper", "offline"] as EnforcementState[]).map((state) => (
              <span key={state} className="flex items-center gap-1.5">
                <StatusDot tone={enforcementTone[state]} />
                <span className="text-[10px] text-[var(--text-3)]">{enforcementLabel[state]}</span>
              </span>
            ))}
          </div>
        </>
      ) : null}

      {overlay}
    </div>
  );
}

function MapControl({
  active,
  onClick,
  label,
  icon,
  iconOnly = false,
}: Readonly<{ active: boolean; onClick: () => void; label: string; icon: React.ReactNode; iconOnly?: boolean }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-6 items-center gap-1.5 rounded-[var(--r-xs)] px-1.5 text-[11px] transition-colors duration-[var(--t-fast)]",
        active
          ? "bg-[var(--brand)] font-semibold text-[var(--brand-on)]"
          : "text-[var(--text-3)] hover:bg-[var(--chrome-hover)] hover:text-[var(--text)]",
      )}
    >
      {icon}
      {!iconOnly ? <span>{label}</span> : null}
    </button>
  );
}

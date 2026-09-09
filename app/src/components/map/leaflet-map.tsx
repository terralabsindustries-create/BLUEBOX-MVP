"use client";

import { useEffect, useMemo, useState } from "react";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { type EnforcementState, enforcementLabel, toneHex } from "@/lib/status";

export interface MapMarker {
  id: string;
  registrationNumber: string;
  coords: [number, number];
  speed: number;
  limit: number;
  road: string;
  device: string;
  state: EnforcementState;
}

/**
 * Marker colour is the shared status palette — the same red a violation chip
 * uses in the table. A reviewer moving between the register and the map must
 * never have to relearn what a colour means.
 */
const colorFor: Record<EnforcementState, string> = {
  normal: toneHex.ok,
  near: toneHex.warn,
  overspeed: toneHex.crit,
  violation: toneHex.crit,
  offline: toneHex.idle,
  tamper: toneHex.tamper,
};

/**
 * Healthy vehicles stay deliberately quiet.
 *
 * A map where every vehicle shouts is a map nobody reads. Normal traffic is a
 * small, low-contrast dot; anything needing attention is larger, brighter and
 * ringed; the selected vehicle gets the brand halo. Visual weight tracks
 * operational priority, so the eye lands on the right marker without filtering.
 */
function iconFor(state: EnforcementState, selected: boolean) {
  const attention = state !== "normal";
  const size = selected ? 16 : attention ? 12 : 8;
  const color = colorFor[state];
  const ring = selected
    ? `box-shadow:0 0 0 3px rgba(255,93,58,0.35), 0 0 0 1.5px #FF5D3A, 0 2px 6px rgba(0,0,0,0.6);`
    : attention
      ? `box-shadow:0 0 0 3px ${color}33, 0 1px 4px rgba(0,0,0,0.5);`
      : `box-shadow:0 1px 3px rgba(0,0,0,0.5);`;

  return L.divIcon({
    className: "bluebox-marker",
    html: `<span style="
      display:block;width:${size}px;height:${size}px;border-radius:999px;
      background:${color};
      border:1.5px solid rgba(244,245,246,${attention || selected ? 0.9 : 0.45});
      ${ring}
    "></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/** Recentres when the deployment jurisdiction changes. */
function Recentre({ center, zoom }: Readonly<{ center: [number, number]; zoom: number }>) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
}

/** Pans to the selected vehicle without yanking the operator's view around. */
function FollowSelection({ target }: Readonly<{ target: [number, number] | null }>) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    if (map.getBounds().contains(target)) return;
    map.panTo(target, { animate: true, duration: 0.4 });
  }, [map, target]);
  return null;
}

export function LeafletMap({
  markers,
  selectedVehicleId,
  onSelect,
  showHeatmap,
  center,
  zoom,
  speedUnit,
  convert,
}: Readonly<{
  markers: MapMarker[];
  selectedVehicleId: string;
  onSelect: (id: string) => void;
  showHeatmap: boolean;
  center: [number, number];
  zoom: number;
  speedUnit: string;
  convert: (kph: number) => number;
}>) {
  const [tilesFailed, setTilesFailed] = useState(false);
  const selected = useMemo(
    () => markers.find((item) => item.id === selectedVehicleId) ?? null,
    [markers, selectedVehicleId],
  );

  /**
   * Offline substrate.
   *
   * The product's central claim is that it keeps working without a network, so
   * a dead tile server must not produce a broken-looking screen. This renders a
   * survey grid with markers placed by their real relative geography, and says
   * plainly that basemap imagery is unavailable — a degraded but *honest*
   * spatial surface, which is exactly what offline-first should look like.
   */
  if (tilesFailed) {
    const lats = markers.map((m) => m.coords[0]);
    const lngs = markers.map((m) => m.coords[1]);
    const minLat = Math.min(...lats, center[0] - 0.1);
    const maxLat = Math.max(...lats, center[0] + 0.1);
    const minLng = Math.min(...lngs, center[1] - 0.1);
    const maxLng = Math.max(...lngs, center[1] + 0.1);
    const spanLat = maxLat - minLat || 1;
    const spanLng = maxLng - minLng || 1;

    return (
      <div className="map-offline relative h-full w-full overflow-hidden">
        {markers.map((marker) => {
          const left = 8 + ((marker.coords[1] - minLng) / spanLng) * 84;
          const top = 88 - ((marker.coords[0] - minLat) / spanLat) * 76;
          const active = marker.id === selectedVehicleId;
          const attention = marker.state !== "normal";
          return (
            <button
              key={marker.id}
              type="button"
              aria-label={`${marker.registrationNumber} — ${Math.round(convert(marker.speed))} ${speedUnit} on ${marker.road}, ${enforcementLabel[marker.state]}`}
              onClick={() => onSelect(marker.id)}
              className="absolute rounded-full border transition-transform duration-[var(--t-base)] hover:scale-125"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width: active ? 14 : attention ? 11 : 7,
                height: active ? 14 : attention ? 11 : 7,
                background: colorFor[marker.state],
                borderColor: active ? "var(--brand)" : "rgba(244,245,246,0.5)",
                borderWidth: active ? 2 : 1,
                boxShadow: active ? "0 0 0 3px rgba(255,93,58,0.3)" : undefined,
              }}
            />
          );
        })}

        <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-[var(--r-sm)] border border-[var(--warn-line)] bg-[var(--warn-dim)] px-2 py-1">
          <span aria-hidden className="dot" data-status="warn" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--warn-text)]">
            Basemap unavailable · positions live
          </span>
        </div>
      </div>
    );
  }

  return (
    <MapContainer center={center} zoom={zoom} scrollWheelZoom zoomControl className="h-full w-full">
      <Recentre center={center} zoom={zoom} />
      <FollowSelection target={selected?.coords ?? null} />
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        eventHandlers={{ tileerror: () => setTilesFailed(true) }}
      />

      {/* Heat weighting: radius tracks operational severity, not vehicle count,
          so a single tamper event does not disappear beside routine traffic. */}
      {showHeatmap
        ? markers
            .filter((marker) => marker.state !== "normal")
            .map((marker) => (
              <Circle
                key={`heat-${marker.id}`}
                center={marker.coords}
                radius={marker.state === "tamper" ? 2200 : marker.state === "overspeed" ? 1800 : 1100}
                pathOptions={{
                  color: colorFor[marker.state],
                  fillColor: colorFor[marker.state],
                  fillOpacity: 0.16,
                  weight: 0,
                }}
              />
            ))
        : null}

      {markers.map((marker) => (
        <Marker
          key={marker.id}
          position={marker.coords}
          icon={iconFor(marker.state, marker.id === selectedVehicleId)}
          eventHandlers={{ click: () => onSelect(marker.id) }}
        >
          <Popup>
            <div className="min-w-[180px]">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-2.5 py-1.5">
                <span className="t-reg">{marker.registrationNumber}</span>
                <span
                  className="text-[9px] font-bold uppercase tracking-[0.06em]"
                  style={{ color: colorFor[marker.state] }}
                >
                  {enforcementLabel[marker.state]}
                </span>
              </div>
              <div className="px-2.5 py-2">
                <p className="t-mono text-[var(--text)]">
                  <span className="text-[15px] font-semibold">{Math.round(convert(marker.speed))}</span>
                  <span className="text-[var(--text-4)]"> / {Math.round(convert(marker.limit))} {speedUnit}</span>
                </p>
                <p className="mt-1 text-[11px] text-[var(--text-3)]">{marker.road}</p>
                <p className="t-mono-sm mt-0.5 text-[var(--text-4)]">{marker.device}</p>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

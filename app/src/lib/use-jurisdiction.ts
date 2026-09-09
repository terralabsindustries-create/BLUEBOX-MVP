"use client";

import { useMemo } from "react";
import { useSimulationStore } from "@/store/simulation-store";
import {
  type Jurisdiction,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatDistance,
  formatNumber,
  formatPrecise,
  formatSpeed,
  formatTime,
  getJurisdiction,
  jurisdictionLabel,
  speedValue,
  toDisplaySpeed,
} from "@/lib/jurisdiction";

/**
 * The jurisdiction, with every formatter already bound to it.
 *
 * Components call `j.speed(92)` rather than importing a formatter and
 * remembering to thread the active deployment through it. That is the whole
 * point: the moment formatting requires an extra argument, someone eventually
 * hardcodes "km/h" instead, and the product stops being international.
 */
export function useJurisdiction() {
  const id = useSimulationStore((state) => state.jurisdictionId);

  return useMemo(() => {
    const j = getJurisdiction(id);
    return {
      ...j,
      /** The raw record, for the few places that need to pass it on. */
      config: j as Jurisdiction,
      label: jurisdictionLabel(j),

      /** `92 km/h` — a reading with its unit. */
      speed: (kph: number, decimals?: number) => formatSpeed(kph, j, { decimals }),
      /** `92` — the numeral alone, for large instrument displays. */
      speedValue: (kph: number) => speedValue(kph, j),
      /** Unrounded, for gauge geometry and threshold maths. */
      speedRaw: (kph: number) => toDisplaySpeed(kph, j),
      speedUnitLabel: j.speedUnit,

      distance: (km: number) => formatDistance(km, j),
      time: (value: string, seconds?: boolean) => formatTime(value, j, { seconds }),
      date: (value: string) => formatDate(value, j),
      dateTime: (value: string) => formatDateTime(value, j),
      precise: (value: string) => formatPrecise(value, j),
      currency: (amount: number) => formatCurrency(amount, j),
      number: (value: number) => formatNumber(value, j),
    };
  }, [id]);
}

export type BoundJurisdiction = ReturnType<typeof useJurisdiction>;

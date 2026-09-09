"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * True only after hydration. Persisted UI preferences (collapsed rail,
 * presentation mode) live in localStorage, which the server cannot see — so
 * they are applied only once this returns true, keeping the first client render
 * identical to the server's.
 */
export function useHydrated() {
  return useSyncExternalStore(noop, onClient, onServer);
}

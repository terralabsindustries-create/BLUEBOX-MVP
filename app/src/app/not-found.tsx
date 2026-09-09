import Link from "next/link";
import { TerraMark } from "@/components/layout/brand-mark";
import { PRODUCT } from "@/components/layout/nav-config";

/**
 * A route that does not exist is a system state like any other, so it gets the
 * product's own chrome rather than the framework's unstyled default — an
 * operator who mistypes a URL during a demonstration should still be looking at
 * BlueBox One.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-[var(--chrome)] px-6 text-center">
      <TerraMark className="h-9 w-9" />

      <p className="t-label mt-6">Route not found</p>
      <h1 className="mt-2 text-[19px] font-semibold tracking-[-0.017em] text-[var(--text)]">
        This screen does not exist
      </h1>
      <p className="mt-2 max-w-sm text-[12.5px] leading-relaxed text-[var(--text-3)]">
        The address requested is not part of the {PRODUCT.name} console. Return to the command overview, or use the
        global search to find a vehicle, device or evidence record.
      </p>

      <Link
        href="/dashboard"
        className="mt-6 inline-flex h-8 items-center rounded-[var(--r-sm)] border border-[var(--brand)] bg-[var(--brand)] px-4 text-[12.5px] font-semibold text-[var(--brand-on)] transition-colors hover:bg-[var(--brand-hover)]"
      >
        Back to Overview
      </Link>

      <p className="mt-10 text-[9px] font-semibold uppercase tracking-[0.24em] text-[var(--text-4)]">
        {PRODUCT.vendor}
      </p>
    </div>
  );
}

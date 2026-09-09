import { cn } from "@/lib/utils";
import { PRODUCT } from "@/components/layout/nav-config";

/**
 * The TerraLabs symbol, inlined.
 *
 * Inline rather than an `<img>` so it inherits `currentColor` where we want it
 * monochrome (collapsed rail, boot sequence) and keeps the brand orange where
 * we want it to assert itself. An external SVG can do neither, and in a bundle
 * that must run with no network it is one less request.
 */
export function TerraMark({
  className,
  monochrome = false,
}: Readonly<{ className?: string; monochrome?: boolean }>) {
  return (
    <svg
      viewBox="0 0 847 713"
      aria-hidden
      className={cn("block", className)}
      fill="none"
    >
      <path
        d="M10 506V318C10 169 130 51 281 51h316c126 0 220 99 220 228 0 127-94 229-220 229H23c-7 0-13-6-13-13Z"
        fill={monochrome ? "currentColor" : "var(--brand)"}
      />
      <g
        fill="none"
        stroke={monochrome ? "var(--chrome)" : "#fff"}
        strokeWidth="46"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M104 447V246c0-40 32-72 72-72h250c72 0 130 58 130 130s-58 130-130 130H104" />
        <path d="M214 447c0-30 24-54 54-54h108c30 0 54-24 54-54s-24-54-54-54H222" />
      </g>
    </svg>
  );
}

/**
 * Product lockup for the sidebar: symbol, product name, vendor line.
 *
 * Inside the operational application the mark stays small — an officer needs
 * the navigation, not the branding. The full lockup is reserved for the boot
 * sequence and the About surface.
 */
export function BrandLockup({
  collapsed = false,
  className,
}: Readonly<{ collapsed?: boolean; className?: string }>) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <TerraMark className="h-[22px] w-[22px] flex-none" />
      {!collapsed ? (
        <span className="min-w-0 leading-none">
          <span className="block truncate text-[13px] font-semibold tracking-[-0.015em] text-[var(--text)]">
            {PRODUCT.name}
          </span>
          <span className="mt-[3px] block truncate text-[8.5px] font-semibold uppercase tracking-[0.14em] text-[var(--text-4)]">
            {PRODUCT.vendor}
          </span>
        </span>
      ) : null}
    </span>
  );
}

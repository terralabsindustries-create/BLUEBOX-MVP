import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "@/app/globals.css";

/**
 * Two families, one job each.
 *
 * Geist carries the interface — highly legible at 12–13px, which is where this
 * product actually lives. Geist Mono carries telemetry: anything that came off
 * a device is set in mono, so a reader can tell a *measurement* from a
 * *description* without reading either. That is the whole typographic system.
 *
 * `next/font` self-hosts both at build time, so the portable Windows bundle
 * makes no network request for fonts at runtime.
 */
const sans = Geist({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-data",
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Cascadia Mono", "Consolas", "monospace"],
});

export const metadata: Metadata = {
  title: {
    default: "BlueBox One — Road Safety Command",
    template: "%s · BlueBox One",
  },
  description:
    "Connected road safety and enforcement infrastructure by TerraLabs Industries. Offline-first telemetry, signed violation evidence and fleet integrity monitoring.",
  applicationName: "BlueBox One",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#090B0D",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" className={`${sans.variable} ${mono.variable}`}>
      <body className="antialiased">
        {children}
        <Toaster
          position="bottom-right"
          theme="dark"
          offset={16}
          gap={8}
          toastOptions={{ duration: 4200 }}
        />
      </body>
    </html>
  );
}

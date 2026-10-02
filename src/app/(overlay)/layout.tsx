import type { Metadata } from "next";
import "../globals.css";
import { fontVariables } from "../fonts";

export const metadata: Metadata = {
  title: "RepOne Broadcast Overlay",
};

// A SEPARATE root layout (via the (overlay) route group) so the page background
// is genuinely transparent — required for these routes to work as OBS/vMix/
// YoloBox browser sources. The (app) group's root layout paints an opaque
// background for the admin/dashboard UI; this one deliberately does not.
// Fonts are bundled locally (src/app/fonts.ts); colours come from --broadcast-*.
export default function OverlayRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${fontVariables}`}>
      <body className="h-full w-full bg-transparent">{children}</body>
    </html>
  );
}

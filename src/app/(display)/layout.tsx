import type { Metadata } from "next";
import "../globals.css";
import { fontVariables } from "../fonts";

export const metadata: Metadata = { title: "RepOne Venue Display" };

// A separate root layout for the venue TV: opaque black, no cursor, no
// scrolling. It runs signed out in a kiosk browser; colours come from
// --broadcast-* like the overlays, so the app's theme never reaches it.
export default function DisplayRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${fontVariables}`} style={{ colorScheme: "dark" }}>
      <body className="h-full w-full cursor-none overflow-hidden bg-broadcast-bg">{children}</body>
    </html>
  );
}

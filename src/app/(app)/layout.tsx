import type { Metadata } from "next";
import "../globals.css";
import { fontVariables } from "../fonts";

// Fonts are bundled locally (no font CDN): see src/app/fonts.ts.

export const metadata: Metadata = {
  title: "RepOne Platform",
  description: "RepOneLive competition operations & broadcast graphics platform",
};

export default function AppRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full antialiased ${fontVariables}`}>
      <body className="min-h-full flex flex-col bg-repone-white text-repone-black">{children}</body>
    </html>
  );
}

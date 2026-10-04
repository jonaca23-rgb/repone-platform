import type { Metadata } from "next";
import "../globals.css";
import { fontVariables } from "../fonts";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "./providers";

// Fonts are bundled locally (no font CDN): see src/app/fonts.ts.

export const metadata: Metadata = {
  title: { default: "RepOne", template: "%s · RepOne" },
  description: "RepOneLive competition operations & broadcast graphics platform",
};

export default function AppRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full antialiased ${fontVariables}`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}

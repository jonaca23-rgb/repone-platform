import type { Metadata } from "next";
import "../globals.css";

// Deliberately no next/font/google here: broadcast/production tooling should
// not depend on reaching an external font CDN at build OR runtime (see the
// reliability principle in the architecture doc — "minimize unnecessary
// external requests"). Font stacks are defined in globals.css instead.

export const metadata: Metadata = {
  title: "RepOne Platform",
  description: "RepOneLive competition operations & broadcast graphics platform",
};

export default function AppRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-repone-white text-repone-black">{children}</body>
    </html>
  );
}

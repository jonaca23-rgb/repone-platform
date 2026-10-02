import type { Metadata } from "next";
import "../globals.css";
import { fontVariables } from "../fonts";

export const metadata: Metadata = {
  title: { default: "RepOne", template: "%s · RepOne" },
  description:
    "Sign in to RepOne to run RepOneLive competitions, broadcasts and your athlete profile.",
};

// A separate root layout (like (overlay)) so the sign-in screens share one dark
// shell for everyone, whatever module they end up in. Fonts are bundled
// locally (no font CDN): see src/app/fonts.ts.
export default function AuthRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full antialiased ${fontVariables}`}>
      <body className="min-h-full bg-background text-foreground">
        <main id="main" tabIndex={-1} className="outline-hidden">
          {children}
        </main>
      </body>
    </html>
  );
}

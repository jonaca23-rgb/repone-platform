import type { Metadata } from "next";
import "./globals.css";
import NotFound from "./(app)/not-found";
import { fontVariables } from "./fonts";

// URLs that match no route skip every root layout (the app has three), so this
// page brings its own document, styles and fonts. Enabled by
// experimental.globalNotFound in next.config.ts.
export const metadata: Metadata = {
  title: "Page not found · RepOne",
};

export default function GlobalNotFound() {
  return (
    <html lang="en" className={`h-full antialiased ${fontVariables}`}>
      <body className="min-h-full bg-background text-foreground">
        <NotFound />
      </body>
    </html>
  );
}

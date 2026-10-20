"use client";

import "./globals.css";
import { ErrorScreen } from "@/components/app/ErrorScreen";
import { fontVariables } from "./fonts";

// Last-resort boundary for errors in a root layout. It replaces the whole
// document, so it brings its own <html>/<body>, styles and fonts.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en" className={`h-full antialiased ${fontVariables}`}>
      <body className="min-h-full bg-background text-foreground">
        <title>Something went wrong · RepOne</title>
        <ErrorScreen as="main" error={error} retry={retry} />
      </body>
    </html>
  );
}

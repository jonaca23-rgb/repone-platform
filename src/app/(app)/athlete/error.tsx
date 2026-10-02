"use client";

import { ErrorScreen } from "@/components/app/ErrorScreen";

// The same recovery screen as the rest of the app, inside the athlete shell
// (which already provides the page's <main>).
export default function AthleteError(props: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorScreen {...props} as="div" />;
}

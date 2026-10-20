"use client";

import { ErrorScreen } from "@/components/app/ErrorScreen";

// Inside the operator shell, which already provides the page's <main>.
export default function DashboardError(props: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorScreen {...props} as="div" />;
}

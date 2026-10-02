"use client";

import { ErrorScreen } from "@/components/app/ErrorScreen";

// Any unexpected error on a staff, athlete or public page. Keeps the operator
// on a page with a way forward instead of Next's bare error screen; `retry`
// re-fetches the segment, which is usually all a dropped connection needs.
export default function AppError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorScreen {...props} />;
}

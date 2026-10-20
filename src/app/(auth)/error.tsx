"use client";

import { ErrorScreen } from "@/components/app/ErrorScreen";

// The auth layout already provides <main>, so the screen renders as a div.
export default function AuthError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorScreen as="div" error={error} retry={retry} />;
}

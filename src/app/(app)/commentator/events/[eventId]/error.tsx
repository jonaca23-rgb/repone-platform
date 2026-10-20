"use client";

import { ErrorScreen } from "@/components/app/ErrorScreen";

// Inside the operator shell (which already provides the page's <main>), so the
// top bar and event tabs stay usable.
export default function CommentatorEventError(props: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorScreen {...props} as="div" />;
}

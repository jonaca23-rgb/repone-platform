"use client";

import { useEffect } from "react";

const RETRY_MS = 5000;

// An OBS/vMix browser source must never put an error card on air. Render
// nothing (the layout is transparent) and quietly retry until the page loads
// again, e.g. after a network blip at the venue.
export default function OverlayError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
    const id = setTimeout(() => retry(), RETRY_MS);
    return () => clearTimeout(id);
  }, [error, retry]);

  return null;
}

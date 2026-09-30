"use client";

import { useEffect, useState } from "react";
import { estimateClockOffsetMs } from "@/lib/timer/compute";

// One measurement per page load, shared by every timer on the page.
let offsetPromise: Promise<number> | null = null;

async function measure(): Promise<number> {
  // Keep the sample with the shortest round trip: the least network noise.
  let best: { rtt: number; offset: number } | null = null;
  for (let i = 0; i < 3; i++) {
    const start = Date.now();
    const res = await fetch("/api/time", { cache: "no-store" });
    const end = Date.now();
    const { now } = (await res.json()) as { now: number };
    const sample = { rtt: end - start, offset: estimateClockOffsetMs(start, now, end) };
    if (!best || sample.rtt < best.rtt) best = sample;
  }
  return best?.offset ?? 0;
}

/**
 * Milliseconds to add to Date.now() to get the server's time. 0 until the
 * first measurement lands (and if it fails: a skewed display beats no timer).
 */
export function useServerClockOffset(): number {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    let cancelled = false;
    offsetPromise ??= measure().catch(() => {
      offsetPromise = null; // try again on the next mount
      return 0;
    });
    offsetPromise.then((ms) => {
      if (!cancelled) setOffset(ms);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return offset;
}

"use client";

import { useEffect } from "react";
import { DisplayStage } from "@/components/display/DisplayStage";
import { StandbyScreen } from "@/components/display/StandbyScreen";

/** How often a venue display that failed to load tries again. */
const RETRY_MS = 5_000;

/**
 * A venue display that couldn't read its snapshot (venue wifi, a database
 * blip) stands by on the RepOne mark and keeps trying, instead of leaving an
 * error page on the TV until someone walks over to reload it.
 */
export default function DisplayError({ reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    const id = setInterval(reset, RETRY_MS);
    return () => clearInterval(id);
  }, [reset]);
  return (
    <DisplayStage>
      <StandbyScreen />
    </DisplayStage>
  );
}

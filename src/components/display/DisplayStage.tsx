"use client";

import { ScaledStage } from "@/components/graphics/BroadcastStage";
import { DISPLAY_STAGE } from "@/lib/broadcast/stage";

/**
 * The 1080x1920 portrait stage the venue display is drawn on, scaled to the
 * TV (2x on a 4K portrait screen). Opaque black: it is the whole picture.
 */
export function DisplayStage({ children }: { children: React.ReactNode }) {
  return (
    <ScaledStage stage={DISPLAY_STAGE} testId="display-stage" className="bg-broadcast-bg">
      {children}
    </ScaledStage>
  );
}

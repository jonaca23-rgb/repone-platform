"use client";

import { useLayoutEffect, useState } from "react";
import { STAGE, stageOffset, stageScale } from "@/lib/broadcast/stage";
import { cn } from "@/lib/utils";

/**
 * The 1920x1080 stage every overlay is drawn on, scaled to whatever viewport
 * the browser source gives it: YoloBox may render a web overlay at 1280x720,
 * OBS at 1080p or 4K. Hidden until measured, so a small viewport never shows
 * an unscaled, cut-off frame. The background stays transparent.
 */
export function BroadcastStage({ children }: { children: React.ReactNode }) {
  const [fit, setFit] = useState<{ s: number; x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const { innerWidth: w, innerHeight: h } = window;
      setFit({ s: stageScale(w, h), ...stageOffset(w, h) });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  return (
    <div className="fixed inset-0 overflow-hidden">
      <div
        data-testid="broadcast-stage"
        className="absolute top-0 left-0 origin-top-left"
        style={{
          width: `${STAGE.width}px`,
          height: `${STAGE.height}px`,
          transform: fit ? `translate(${fit.x}px, ${fit.y}px) scale(${fit.s})` : undefined,
          visibility: fit ? "visible" : "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** The 5% action-safe area of the stage: anything that must never be cut off goes in here. */
export function SafeArea({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("absolute", className)}
      style={{ inset: `${STAGE.safeY}px ${STAGE.safeX}px` }}
    >
      {children}
    </div>
  );
}

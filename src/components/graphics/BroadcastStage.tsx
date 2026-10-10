"use client";

import { useLayoutEffect, useState } from "react";
import { fitStage, STAGE } from "@/lib/broadcast/stage";
import { cn } from "@/lib/utils";

/**
 * A fixed-size stage scaled to whatever viewport shows it, keeping its shape
 * and sitting centred. Hidden until measured, so a small viewport never shows
 * an unscaled, cut-off frame. Children are laid out in stage pixels.
 */
export function ScaledStage({
  stage,
  testId,
  className,
  children,
}: {
  stage: { width: number; height: number };
  testId?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [fit, setFit] = useState<{ s: number; x: number; y: number } | null>(null);
  const { width, height } = stage;
  useLayoutEffect(() => {
    const measure = () =>
      setFit(fitStage({ width, height }, window.innerWidth, window.innerHeight));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [width, height]);
  return (
    <div className={cn("fixed inset-0 overflow-hidden", className)}>
      <div
        data-testid={testId}
        className="absolute top-0 left-0 origin-top-left"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          transform: fit ? `translate(${fit.x}px, ${fit.y}px) scale(${fit.s})` : undefined,
          visibility: fit ? "visible" : "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * The 1920x1080 stage every overlay is drawn on, scaled to whatever viewport
 * the browser source gives it: YoloBox may render a web overlay at 1280x720,
 * OBS at 1080p or 4K. The background stays transparent.
 */
export function BroadcastStage({ children }: { children: React.ReactNode }) {
  return (
    <ScaledStage stage={STAGE} testId="broadcast-stage">
      {children}
    </ScaledStage>
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

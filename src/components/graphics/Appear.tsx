"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export const EXIT_MS = 320;

type Variant = "slide-left" | "rise" | "fade";

function reducedMotion() {
  return (
    typeof window !== "undefined" &&
    (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false)
  );
}

/**
 * Shows a broadcast graphic with an entrance and keeps it on screen through
 * its exit, so graphics move on and off air instead of popping. Content that
 * changes while shown swaps in place. With reduced motion it simply appears
 * and disappears.
 */
export function Appear({
  show,
  variant,
  className,
  children,
}: {
  show: boolean;
  variant: Variant;
  /** Layout for the wrapper, e.g. "absolute inset-0" around a full-frame card. */
  className?: string;
  children: React.ReactNode;
}) {
  // The last content shown, kept so it can play its exit after the parent
  // stops passing it (a lower third whose athlete was cleared).
  const [shown, setShown] = useState<React.ReactNode>(show ? children : null);
  const [exiting, setExiting] = useState(false);
  const [prevShow, setPrevShow] = useState(show);
  if (show !== prevShow) {
    setPrevShow(show);
    setExiting(!show && !reducedMotion());
  }
  if (show && shown !== children) setShown(children);

  useEffect(() => {
    if (!exiting) return;
    const t = setTimeout(() => setExiting(false), EXIT_MS);
    return () => clearTimeout(t);
  }, [exiting]);

  if (show) {
    return (
      <div data-appear="in" className={cn(`bc-in-${variant}`, className)}>
        {children}
      </div>
    );
  }
  if (exiting) {
    return (
      <div data-appear="out" className={cn(`bc-out-${variant}`, className)}>
        {shown}
      </div>
    );
  }
  return null;
}

"use client";

import { useEffect, useState } from "react";
import { stageScale } from "@/lib/broadcast/stage";

/** The browser source's real viewport and the stage's scale, as the device reports them. */
export function CalibrationReadout() {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const measure = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  if (!size) return null;
  return (
    <p className="text-bc-label tabular-nums">
      Viewport {size.w} × {size.h} · scale {stageScale(size.w, size.h).toFixed(3)}
    </p>
  );
}

"use client";

import { Timer } from "lucide-react";
import { formatClock } from "@/lib/timer/compute";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OnAirSummary } from "./onAir";

/** A label that shortens on a phone; the full word stays for screen readers. */
function Term({ short, full }: { short: string; full: string }) {
  return (
    <dt className="text-muted-foreground">
      <span aria-hidden className="sm:hidden">
        {short}
      </span>
      <span className="max-sm:sr-only">{full}</span>:
    </dt>
  );
}

/**
 * What the audience sees right now, pinned above the board: the heat, the
 * clock, the graphic, the lower third and the sponsor. With no heat on air it
 * says so and offers to put one on, since every overlay is blank until then.
 */
export function OnAirBar({
  connected,
  pending,
  summary,
  timerSeconds,
  offAirHeatNumber,
  onPutOnAir,
  onClear,
}: {
  connected: boolean;
  pending: boolean;
  summary: OnAirSummary;
  timerSeconds: number;
  offAirHeatNumber: number | null;
  onPutOnAir: () => void;
  onClear: () => Promise<unknown>;
}) {
  return (
    <section
      aria-label="On air"
      className="top-[calc(3.5rem+env(safe-area-inset-top))] z-10 border-b border-border bg-card/95 px-4 py-2 backdrop-blur [@media(min-height:600px)]:sticky"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <span
            role="status"
            aria-live="polite"
            className={cn(
              "flex items-center gap-2 text-xs font-semibold tracking-wide uppercase",
              connected ? "text-success-text" : "text-brand-text",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "size-3 rounded-full",
                connected ? "bg-success" : "animate-pulse bg-primary",
              )}
            />
            {connected ? "Live" : "Reconnecting…"}
          </span>
          {summary.heatLabel ? (
            <span className="font-display text-lg font-bold tracking-wide uppercase">
              {summary.heatLabel}
            </span>
          ) : (
            <span className="font-semibold text-warning-text">No heat on air</span>
          )}
          <span className="flex items-center gap-2">
            <Timer aria-hidden className="size-4 text-muted-foreground" />
            <span className="font-display text-lg tabular-nums">{formatClock(timerSeconds)}</span>
            <span className="text-xs tracking-wide text-muted-foreground uppercase">
              {summary.timerStateLabel}
            </span>
          </span>
          <span role="status" aria-live="polite" className="text-xs text-muted-foreground">
            {pending ? "Sending…" : ""}
          </span>
          {offAirHeatNumber !== null ? (
            <Button size="touch" className="ml-auto min-h-11" onClick={onPutOnAir}>
              Put Heat {offAirHeatNumber} on air
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <dl className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <div className="flex gap-1.5">
              <Term short="GFX" full="Graphic" />
              <dd className="font-semibold">{summary.graphicLabel}</dd>
            </div>
            <div className="flex gap-1.5">
              <Term short="L3" full="Lower third" />
              <dd className="font-semibold">{summary.lowerThirdName ?? "None"}</dd>
            </div>
            <div className="flex gap-1.5">
              <Term short="Sponsor" full="Sponsor" />
              <dd className="font-semibold">{summary.sponsorName ?? "None"}</dd>
            </div>
          </dl>
          <span className="ml-auto">
            <ConfirmAction
              trigger="Clear all"
              title="Clear all graphics from air?"
              description="The graphic, the lower third and the sponsor all come off the program output."
              confirmLabel="Clear graphics"
              variant="default"
              triggerVariant="outline"
              triggerSize="default"
              triggerClassName="min-h-11"
              onConfirm={onClear}
            />
          </span>
        </div>
      </div>
    </section>
  );
}

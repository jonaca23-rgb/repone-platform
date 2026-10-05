"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ListOrdered, Radio, Users } from "lucide-react";
import { useBroadcastState } from "@/lib/realtime/useBroadcastState";
import type { FloorHeat } from "@/lib/db/queries";
import type { Database } from "@/lib/db/database.types";
import type { CommentatorAthleteDetails } from "@/lib/db/commentator";
import { wodSummary } from "@/lib/scoring/format";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AthleteCard } from "./AthleteCard";

type BroadcastStateRow = Database["public"]["Tables"]["broadcast_state"]["Row"];

// Read-only, tablet-first view for whoever is on the mic: current heat,
// who's in it, and enough of their stats/history to talk about them without
// needing a second screen. Follows the live heat the same way Score
// Keeper/every overlay does, with the same manual override + "Follow live
// heat" recovery, so a commentator can jump ahead to preview the next heat
// while the current one is still running and get back on track with one tap.
// The event name is in the operator shell's top bar, not repeated here.
export function CommentatorClient({
  floorId,
  heats,
  initialBroadcastState,
  detailsByAthleteId,
  hideBackLink = false,
}: {
  floorId: string;
  heats: FloorHeat[];
  initialBroadcastState: BroadcastStateRow | null;
  detailsByAthleteId: Record<string, CommentatorAthleteDetails>;
  // The event-scoped Commentator dashboard
  // (commentator/events/[eventId]/dashboard/EventCommentatorDashboard.tsx)
  // embeds this component directly and already has the event tabs and the
  // top bar to lead back out, plus a floor toggle when an event has more
  // than one floor — so the standalone "Choose a different floor" link
  // below (which points at the old top-level /commentator picker) would be
  // a confusing, event-context-losing detour there. Defaults to
  // false so the original standalone /commentator/[floorId] route's
  // behavior is unchanged.
  hideBackLink?: boolean;
}) {
  const { state, connected } = useBroadcastState(floorId, initialBroadcastState);
  const liveHeatId = state?.current_heat_id ?? null;

  const [following, setFollowing] = useState(true);
  const [manualHeatId, setManualHeatId] = useState<string | null>(null);

  const activeHeatId = following
    ? (liveHeatId ?? heats[0]?.id ?? null)
    : (manualHeatId ?? heats[0]?.id ?? null);
  const heat = heats.find((h) => h.id === activeHeatId) ?? heats[0] ?? null;

  const heatIndex = heat ? heats.findIndex((h) => h.id === heat.id) : -1;
  const goToHeat = (id: string) => {
    setFollowing(false);
    setManualHeatId(id);
  };

  const backLink = hideBackLink ? null : (
    <Link
      href="/commentator"
      className="inline-flex min-h-11 w-fit items-center gap-1 rounded-sm text-sm text-brand-text underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
    >
      <ChevronLeft className="size-4" aria-hidden />
      Choose a different floor
    </Link>
  );

  if (!heat) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-10">
        {backLink}
        <EmptyState icon={ListOrdered} title="No heats scheduled on this floor yet" />
      </div>
    );
  }

  const lanes = heat.lanes.filter((l) => l.athleteId).sort((a, b) => a.laneNumber - b.laneNumber);

  return (
    <div className="flex flex-col">
      {/* Heat header: sticky unless the screen is short (a phone in landscape). */}
      <header className="top-[calc(3.5rem+env(safe-area-inset-top))] z-10 border-b border-border bg-background/95 backdrop-blur [@media(min-height:600px)]:sticky">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3">
          {backLink}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold tracking-wide uppercase sm:text-3xl">
                {heat.wod.name} · Heat {heat.heatNumber}
                {heat.heatCount ? ` / ${heat.heatCount}` : ""}
              </h1>
              <p className="text-sm font-semibold tracking-wide text-brand-text uppercase sm:text-base">
                {heat.division.name}
              </p>
            </div>
            <span
              aria-live="polite"
              className="flex shrink-0 items-center gap-2 text-sm font-medium"
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
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              aria-label="Previous heat"
              disabled={heatIndex <= 0}
              onClick={() => heatIndex > 0 && goToHeat(heats[heatIndex - 1].id)}
            >
              <ChevronLeft aria-hidden />
            </Button>
            <Label htmlFor="commentator-heat" className="sr-only">
              Heat
            </Label>
            <Select value={heat.id} onValueChange={goToHeat}>
              <SelectTrigger
                id="commentator-heat"
                className="min-w-0 flex-1 basis-48 data-[size=default]:h-11"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {heats.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.wod.name} — Heat {h.heatNumber} ({h.division.name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              aria-label="Next heat"
              disabled={heatIndex === -1 || heatIndex >= heats.length - 1}
              onClick={() =>
                heatIndex >= 0 && heatIndex < heats.length - 1 && goToHeat(heats[heatIndex + 1].id)
              }
            >
              <ChevronRight aria-hidden />
            </Button>
            {following ? (
              <span className="flex min-h-11 items-center gap-2 text-xs font-semibold tracking-wide text-brand-text uppercase">
                <Radio className="size-4" aria-hidden />
                Following live heat
              </span>
            ) : (
              <Button
                type="button"
                variant="secondary"
                className="min-h-11 gap-2"
                onClick={() => {
                  setFollowing(true);
                  setManualHeatId(null);
                }}
              >
                <Radio aria-hidden />
                Follow live heat
              </Button>
            )}
          </div>
          <details className="rounded-lg border border-border">
            <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-semibold">
              {wodSummary(heat.wod)}
            </summary>
            <p className="px-3 pb-3 text-sm whitespace-pre-wrap">
              {heat.wod.description || (
                <span className="text-muted-foreground">No description on file.</span>
              )}
            </p>
          </details>
        </div>
      </header>

      <section aria-label="Athletes in this heat" className="mx-auto w-full max-w-7xl px-4 py-4">
        {lanes.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lanes.map((lane) => (
              <li key={lane.laneNumber}>
                <AthleteCard lane={lane} details={detailsByAthleteId[lane.athleteId!]} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Users} title="No athletes assigned to lanes for this heat yet" />
        )}
      </section>
    </div>
  );
}

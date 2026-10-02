"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ListOrdered, Radio, Users } from "lucide-react";
import { useBroadcastState } from "@/lib/realtime/useBroadcastState";
import type { FloorHeat } from "@/lib/db/queries";
import type { Database } from "@/lib/db/database.types";
import type { CommentatorAthleteDetails } from "@/lib/db/commentator";
import { EmptyState } from "@/components/app/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type BroadcastStateRow = Database["public"]["Tables"]["broadcast_state"]["Row"];

const SECTION_LABEL = "mb-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase";
const CHIP = "rounded-full bg-muted px-3 py-1 text-sm";

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
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 sm:gap-6">
      {backLink}

      {/* Header — big enough to read at arm's length on a tablet */}
      <Card size="sm">
        <CardContent className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-bold tracking-wide uppercase">
              {heat.wod.name} · Heat {heat.heatNumber}
              {heat.heatCount ? ` / ${heat.heatCount}` : ""}
            </h1>
            <p className="text-base font-semibold tracking-wide text-brand-text uppercase">
              {heat.division.name}
            </p>
          </div>
          <span aria-live="polite" className="flex items-center gap-2 text-sm font-medium">
            <span
              aria-hidden
              className={cn(
                "size-3 rounded-full",
                connected ? "bg-success" : "animate-pulse bg-primary",
              )}
            />
            {connected ? "Live" : "Reconnecting…"}
          </span>
        </CardContent>
      </Card>

      {/* Heat picker / follow controls — same pattern as Score Keeper */}
      <Card size="sm">
        <CardContent className="flex flex-row flex-wrap items-end gap-3">
          <div className="grid min-w-0 flex-1 basis-56 grid-cols-[minmax(0,1fr)] gap-2">
            <Label
              htmlFor="commentator-heat"
              className="text-xs tracking-wide text-muted-foreground uppercase"
            >
              Heat
            </Label>
            <Select value={heat.id} onValueChange={goToHeat}>
              <SelectTrigger
                id="commentator-heat"
                className="w-full min-w-0 text-lg data-[size=default]:h-12"
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
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="touch"
              className="gap-2 px-4"
              disabled={heatIndex <= 0}
              onClick={() => heatIndex > 0 && goToHeat(heats[heatIndex - 1].id)}
            >
              <ChevronLeft aria-hidden />
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="touch"
              className="gap-2 px-4"
              disabled={heatIndex === -1 || heatIndex >= heats.length - 1}
              onClick={() =>
                heatIndex >= 0 && heatIndex < heats.length - 1 && goToHeat(heats[heatIndex + 1].id)
              }
            >
              Next
              <ChevronRight aria-hidden />
            </Button>
          </div>
          {following ? (
            <span className="flex min-h-12 items-center gap-2 text-xs font-semibold tracking-wide text-brand-text uppercase">
              <Radio className="size-4" aria-hidden />
              Following live heat
            </span>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="touch"
              className="gap-2 px-4"
              onClick={() => {
                setFollowing(true);
                setManualHeatId(null);
              }}
            >
              <Radio aria-hidden />
              Follow live heat
            </Button>
          )}
        </CardContent>
      </Card>

      {/* One card per lane — everything a commentator needs on this athlete
          without switching screens. */}
      <div className="flex flex-col gap-4">
        {lanes.map((lane) => {
          const details = detailsByAthleteId[lane.athleteId!];
          const hasStats =
            details &&
            (details.lifts.length > 0 ||
              details.benchmarks.length > 0 ||
              details.history.length > 0);
          return (
            <Card key={lane.laneNumber}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="flex min-w-0 items-center gap-3 text-2xl font-bold">
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded bg-primary text-base font-bold text-primary-foreground">
                      {lane.laneNumber}
                    </span>
                    <span className="min-w-0">{lane.name}</span>
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    {lane.affiliate && <span>{lane.affiliate}</span>}
                    {details?.ageCategoryLabel && (
                      <Badge variant="outline" className="tracking-wide text-brand-text uppercase">
                        {details.ageCategoryLabel}
                      </Badge>
                    )}
                  </div>
                </div>

                {!hasStats ? (
                  <p className="text-sm text-muted-foreground">
                    No lifts, benchmarks, or competition history on file yet.
                  </p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {(details!.lifts.length > 0 || details!.benchmarks.length > 0) && (
                      <div>
                        <h3 className={SECTION_LABEL}>Lifts &amp; Benchmarks</h3>
                        <div className="flex flex-wrap gap-2">
                          {details!.lifts.map((l) => (
                            <span key={l.id} className={CHIP}>
                              {l.label}: <span className="font-semibold">{l.valueDisplay}</span>
                            </span>
                          ))}
                          {details!.benchmarks.map((b) => (
                            <span key={b.id} className={CHIP}>
                              {b.name}: <span className="font-semibold">{b.resultDisplay}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {details!.history.length > 0 && (
                      <div>
                        <h3 className={SECTION_LABEL}>Previous Standings</h3>
                        <div className="flex flex-col gap-1.5">
                          {details!.history.map((h) => (
                            <div key={h.eventId} className="text-sm">
                              <span className="font-semibold">{h.eventName}</span>
                              <span className="text-muted-foreground"> ({h.divisionName})</span>
                              {h.overall?.placement && (
                                <span className="ml-2 font-semibold text-brand-text">
                                  #{h.overall.placement} overall
                                </span>
                              )}
                              {h.wods.length > 0 && (
                                <div className="mt-0.5 flex flex-wrap gap-1.5">
                                  {h.wods.map((w) => (
                                    <span
                                      key={w.wodId}
                                      className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                                    >
                                      {w.name}: {w.placement ? `#${w.placement}` : "—"}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {lanes.length === 0 && (
          <EmptyState icon={Users} title="No athletes assigned to lanes for this heat yet" />
        )}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, ListOrdered, Radio, Users } from "lucide-react";
import { useBroadcastState } from "@/lib/realtime/useBroadcastState";
import { floorWatches } from "@/lib/realtime/floorWatches";
import { useRefreshOnChanges } from "@/lib/realtime/useRefreshOnChanges";
import { finishHeat } from "@/lib/actions/heats";
import type { Database } from "@/lib/db/database.types";
import type { LaneResult, ScoringLane, ScoringType } from "@/lib/scoring/format";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { EmptyState } from "@/components/app/EmptyState";
import { LaneList, resultsByAthlete } from "@/components/scoring/LaneList";
import { type LeaderboardRow, LeaderboardSheet } from "@/components/scoring/LeaderboardSheet";
import { ScoreDrawer } from "@/components/scoring/ScoreDrawer";
import { Badge } from "@/components/ui/badge";
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
import { activeHeatId } from "./activeHeat";

export interface ScoreKeeperHeat {
  id: string;
  heatNumber: number;
  heatCount: number | null;
  endedAt: string | null;
  wod: { id: string; name: string; scoring_type: string; time_cap_seconds: number | null };
  division: { id: string; name: string };
  lanes: Array<{
    laneNumber: number;
    athleteId: string | null;
    name: string | null;
    affiliate: string | null;
  }>;
}

export interface ScoreKeeperStanding extends LeaderboardRow {
  athlete_id: string | null;
}

type BroadcastStateRow = Database["public"]["Tables"]["broadcast_state"]["Row"];

const heatLabel = (h: ScoreKeeperHeat) => `${h.wod.name} · Heat ${h.heatNumber}`;

export function ScoreKeeperClient({
  floorId,
  heats,
  initialBroadcastState,
  resultsByHeatId,
  standingsByHeatId,
}: {
  floorId: string;
  heats: ScoreKeeperHeat[];
  initialBroadcastState: BroadcastStateRow | null;
  resultsByHeatId: Record<string, LaneResult[]>;
  standingsByHeatId: Record<string, ScoreKeeperStanding[]>;
}) {
  const { state, connected } = useBroadcastState(floorId, initialBroadcastState);
  const liveHeatId = state?.current_heat_id ?? null;
  // A second scorekeeper's saves and lane changes from Admin show up here
  // without a reload; an open drawer keeps what's typed across the refresh.
  useRefreshOnChanges(
    floorWatches(
      floorId,
      heats.map((h) => h.id),
      { results: true },
    ),
  );

  // By default the screen follows the heat Production has live; picking a
  // heat by hand steps off that, and "Follow live" steps back on.
  const [following, setFollowing] = useState(true);
  const [manualHeatId, setManualHeatId] = useState<string | null>(null);
  // The lane whose drawer is open, and the heat it belongs to (held while open).
  const [open, setOpen] = useState<{ heatId: string; lane: ScoringLane } | null>(null);

  const currentId = activeHeatId({
    following,
    manualHeatId,
    liveHeatId,
    heldHeatId: open?.heatId ?? null,
    firstHeatId: heats[0]?.id ?? null,
  });
  const heat = heats.find((h) => h.id === currentId) ?? heats[0] ?? null;
  const liveHeat = heats.find((h) => h.id === liveHeatId) ?? null;
  const results = useMemo(
    () => resultsByAthlete(heat ? (resultsByHeatId[heat.id] ?? []) : []),
    [heat, resultsByHeatId],
  );

  if (!heat) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState
          icon={ListOrdered}
          title="No heats scheduled on this floor yet"
          description="Set them up in Admin → Heats & Lanes."
        />
      </div>
    );
  }

  const scoringType = heat.wod.scoring_type as ScoringType;
  const lanes: ScoringLane[] = heat.lanes
    .filter((l) => l.athleteId)
    .map((l) => ({
      laneNumber: l.laneNumber,
      athleteId: l.athleteId as string,
      name: l.name ?? "—",
      affiliate: l.affiliate,
    }));
  const recorded = lanes.filter((l) => results.has(l.athleteId)).length;
  const missing = lanes.length - recorded;
  const index = heats.findIndex((h) => h.id === heat.id);
  const pick = (id: string) => {
    setFollowing(false);
    setManualHeatId(id);
  };
  const subtitle = `${heat.wod.name} · ${heat.division.name}`;
  const heldBack =
    open && following && liveHeat && liveHeat.id !== open.heatId
      ? `Production moved to ${heatLabel(liveHeat)}. You'll go there when you close this lane.`
      : undefined;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-3xl flex-col">
      {/* Sticky heat header */}
      <header className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 flex flex-col gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 font-display text-2xl font-bold tracking-wide uppercase">
              {heatLabel(heat)}
              {heat.heatCount ? ` / ${heat.heatCount}` : ""}
              {heat.endedAt && (
                <Badge
                  variant="outline"
                  className="border-success/40 bg-success/10 text-success-text"
                >
                  <Check aria-hidden />
                  Finished
                </Badge>
              )}
            </h1>
            <p className="truncate text-sm font-semibold tracking-wide text-brand-text uppercase">
              {heat.division.name}
            </p>
          </div>
          <span aria-live="polite" className="flex shrink-0 items-center gap-2 text-sm font-medium">
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
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label="Previous heat"
            disabled={index <= 0}
            onClick={() => index > 0 && pick(heats[index - 1].id)}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Label htmlFor="scorekeeper-heat" className="sr-only">
            Heat
          </Label>
          <Select value={heat.id} onValueChange={pick}>
            <SelectTrigger
              id="scorekeeper-heat"
              className="min-w-0 flex-1 data-[size=default]:h-11"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {heats.map((h) => (
                <SelectItem key={h.id} value={h.id}>
                  {heatLabel(h)} ({h.division.name})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label="Next heat"
            disabled={index === -1 || index >= heats.length - 1}
            onClick={() => index < heats.length - 1 && pick(heats[index + 1].id)}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
        {following ? (
          <span className="flex items-center gap-2 text-xs font-semibold tracking-wide text-brand-text uppercase">
            <Radio className="size-4" aria-hidden />
            Following live heat
          </span>
        ) : (
          <Button
            type="button"
            variant="secondary"
            className="min-h-11 w-fit gap-2"
            onClick={() => {
              setFollowing(true);
              setManualHeatId(null);
            }}
          >
            <Radio aria-hidden />
            Follow live heat
          </Button>
        )}
      </header>

      {/* Lane list */}
      <section aria-label="Lanes" className="flex-1 px-4 py-4">
        {lanes.length > 0 ? (
          <LaneList
            lanes={lanes}
            resultsByAthlete={results}
            scoringType={scoringType}
            onOpen={(lane) => setOpen({ heatId: heat.id, lane })}
          />
        ) : (
          <EmptyState
            icon={Users}
            title="No athletes in lanes for this heat yet"
            description="Set that up in Admin → Heats & Lanes."
          />
        )}
      </section>

      {/* Sticky finish bar */}
      <footer className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <p className="text-sm font-medium tabular-nums">
          {recorded} / {lanes.length} recorded
        </p>
        <div className="flex items-center gap-2">
          <LeaderboardSheet
            title={`Leaderboard — ${heat.wod.name} (${heat.division.name})`}
            rows={standingsByHeatId[heat.id] ?? []}
          />
          {lanes.length > 0 && heat.endedAt ? (
            <Button type="button" size="touch" disabled>
              Heat finished
            </Button>
          ) : lanes.length > 0 ? (
            <ConfirmAction
              trigger="Finish heat"
              triggerVariant="default"
              triggerSize="touch"
              variant="default"
              title={`Finish Heat ${heat.heatNumber}?`}
              description={`${heat.wod.name} (${heat.division.name}) is marked completed.${
                missing > 0
                  ? ` ${missing} lane${missing === 1 ? " has" : "s have"} no result and will count as last once the WOD is finished.`
                  : ""
              }`}
              confirmLabel="Finish heat"
              onConfirm={() => finishHeat(heat.id)}
            />
          ) : null}
        </div>
      </footer>

      <ScoreDrawer
        key={open ? `${open.heatId}:${open.lane.athleteId}` : "closed"}
        heatId={open?.heatId ?? heat.id}
        lane={open?.lane ?? null}
        existing={open ? results.get(open.lane.athleteId) : undefined}
        scoringType={scoringType}
        subtitle={subtitle}
        notice={heldBack}
        onClose={() => setOpen(null)}
      />
    </div>
  );
}

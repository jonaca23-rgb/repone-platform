"use client";

import { ListOrdered, Timer } from "lucide-react";
import { useFloorOverlay } from "@/lib/realtime/useFloorOverlay";
import { useLiveTimer } from "@/lib/realtime/useLiveTimer";
import { useStandings } from "@/lib/realtime/useStandings";
import { TimerDisplay } from "@/components/graphics/TimerDisplay";
import { EmptyState } from "@/components/app/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EventLiveFloor } from "@/lib/db/queries";
import { cn } from "@/lib/utils";

// Public, read-only leaderboard for spectators/athletes — no login, no
// controls. Reuses the exact same Realtime hooks the OBS overlays and
// Production Dashboard already use (useFloorOverlay for "what heat is live
// right now," useStandings for the live-updating overall leaderboard), so
// this page updates the instant an operator advances a heat or a scorekeeper
// saves a result — no manual refresh, same as everything else in the app.
export function LiveEventClient({
  floors,
  divisions,
}: {
  floors: EventLiveFloor[];
  divisions: Array<{ id: string; name: string }>;
}) {
  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="now-competing" className="flex flex-col gap-4">
        <h2
          id="now-competing"
          className="text-sm font-semibold tracking-widest text-muted-foreground uppercase"
        >
          Now Competing
        </h2>
        {floors.map((floor) => (
          <FloorNowCompeting key={floor.floorId} floor={floor} />
        ))}
        {floors.length === 0 && (
          <EmptyState
            icon={Timer}
            title="No floors set up yet"
            description="The current heat shows here once the organizer sets up the floors."
          />
        )}
      </section>

      <section aria-labelledby="leaderboard" className="flex flex-col gap-8">
        <h2
          id="leaderboard"
          className="text-sm font-semibold tracking-widest text-muted-foreground uppercase"
        >
          Leaderboard
        </h2>
        {divisions.map((division) => (
          <DivisionLeaderboard key={division.id} division={division} />
        ))}
        {divisions.length === 0 && (
          <EmptyState
            icon={ListOrdered}
            title="No divisions set up yet"
            description="Standings show here once the organizer adds divisions."
          />
        )}
      </section>
    </div>
  );
}

function FloorNowCompeting({ floor }: { floor: EventLiveFloor }) {
  const { state, connected, currentHeat } = useFloorOverlay(
    floor.floorId,
    floor.initialBroadcastState,
    floor.heats,
  );
  const timer = useLiveTimer({
    status: state?.timer_status ?? "idle",
    direction: state?.timer_direction ?? "count_down",
    durationSeconds: state?.timer_duration_seconds ?? 0,
    elapsedAtAnchor: state?.timer_elapsed_at_anchor ?? 0,
    anchorTimeMs: state?.timer_anchor_time ? new Date(state.timer_anchor_time).getTime() : null,
  });

  return (
    <Card size="sm">
      <CardHeader className="flex items-center justify-between gap-3">
        <CardTitle className="text-sm tracking-widest text-muted-foreground uppercase">
          {floor.venueName}: {floor.floorName}
        </CardTitle>
        <span aria-live="polite" className="flex shrink-0 items-center gap-2 text-sm font-medium">
          <span
            aria-hidden
            className={cn(
              "size-2.5 rounded-full",
              connected ? "bg-success" : "animate-pulse bg-primary",
            )}
          />
          <span className={connected ? "text-success-text" : "text-muted-foreground"}>
            {connected ? "Live" : "Reconnecting…"}
          </span>
        </span>
      </CardHeader>

      <CardContent>
        {!currentHeat ? (
          <p className="text-muted-foreground">
            Competition hasn&apos;t started on this floor yet.
          </p>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-2xl font-bold tracking-wide uppercase">
                {currentHeat.wod.name} · Heat {currentHeat.heatNumber}
                {currentHeat.heatCount ? ` / ${currentHeat.heatCount}` : ""}
              </p>
              <p className="text-sm font-semibold tracking-wide text-brand-text uppercase">
                {currentHeat.division.name}
              </p>
              <ul className="mt-3 grid grid-cols-2 gap-1 sm:grid-cols-3">
                {currentHeat.lanes
                  .filter((l) => l.name)
                  .map((l) => (
                    <li key={l.laneNumber} className="text-sm">
                      <span className="text-muted-foreground tabular-nums">{l.laneNumber}.</span>{" "}
                      {l.name}
                    </li>
                  ))}
              </ul>
            </div>
            {state && state.timer_status !== "idle" && (
              <TimerDisplay seconds={timer.displaySeconds} atLimit={timer.atLimit} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DivisionLeaderboard({ division }: { division: { id: string; name: string } }) {
  const rows = useStandings(division.id);

  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-semibold tracking-wide text-brand-text uppercase">{division.name}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No scored results yet. Standings fill in as heats are finished.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table className="[&_tr]:border-border">
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-muted-foreground">Place</TableHead>
                <TableHead className="text-muted-foreground">Athlete</TableHead>
                <TableHead className="text-right text-muted-foreground">Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-bold text-brand-text tabular-nums">
                    {r.placement ?? "—"}
                  </TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {r.points ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

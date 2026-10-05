"use client";

import { useEffect, useState } from "react";
import { ListOrdered, Timer } from "lucide-react";
import { useFloorOverlay } from "@/lib/realtime/useFloorOverlay";
import { useLiveTimer } from "@/lib/realtime/useLiveTimer";
import { useDivisionStandings } from "@/lib/realtime/useDivisionStandings";
import { ordinal } from "@/lib/scoring/format";
import { TimerDisplay } from "@/components/graphics/TimerDisplay";
import { EmptyState } from "@/components/app/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { EventLiveFloor } from "@/lib/db/queries";
import { cn } from "@/lib/utils";

type LiveTab = "now" | "standings";

/** The URL's ?tab= and ?division=, read once on mount; anything unknown falls back. */
function initialFromUrl(defaultTab: LiveTab, divisionIds: string[]) {
  if (typeof window === "undefined") return { tab: defaultTab, division: divisionIds[0] ?? null };
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  const division = params.get("division");
  return {
    tab: tab === "now" || tab === "standings" ? tab : defaultTab,
    division: division && divisionIds.includes(division) ? division : (divisionIds[0] ?? null),
  };
}

/** Keeps the tab and division in the URL without navigating, so a link opens the same view. */
function writeUrl(key: "tab" | "division", value: string) {
  const url = new URL(window.location.href);
  url.searchParams.set(key, value);
  window.history.replaceState(window.history.state, "", url);
}

// Public, read-only live view for spectators and athletes (and the
// commentator's Leaderboard tab): what's on each floor now, and one division's
// standings with each WOD's placing. Reuses the realtime hooks the overlays
// use, so it updates the moment a heat advances or a result is saved.
export function LiveEventClient({
  floors,
  divisions,
  defaultTab = "now",
}: {
  floors: EventLiveFloor[];
  divisions: Array<{ id: string; name: string }>;
  defaultTab?: LiveTab;
}) {
  const [tab, setTab] = useState<LiveTab>(defaultTab);
  const [divisionId, setDivisionId] = useState<string | null>(divisions[0]?.id ?? null);
  // The server renders the defaults; the URL's choice is applied once on mount,
  // so the first client render matches the server's.
  const divisionKey = divisions.map((d) => d.id).join(",");
  useEffect(() => {
    const fromUrl = initialFromUrl(defaultTab, divisionKey ? divisionKey.split(",") : []);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync from the URL once on mount
    setTab(fromUrl.tab);
    setDivisionId(fromUrl.division);
  }, [defaultTab, divisionKey]);

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => {
        setTab(v as LiveTab);
        writeUrl("tab", v);
      }}
      className="flex flex-col gap-6"
    >
      <TabsList className="w-full sm:w-fit">
        <TabsTrigger value="now" className="min-h-11 flex-1 sm:flex-none sm:px-6">
          Now
        </TabsTrigger>
        <TabsTrigger value="standings" className="min-h-11 flex-1 sm:flex-none sm:px-6">
          Standings
        </TabsTrigger>
      </TabsList>

      <TabsContent value="now" className="flex flex-col gap-4">
        <h2 className="sr-only">Now competing</h2>
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
      </TabsContent>

      <TabsContent value="standings" className="flex flex-col gap-4">
        <h2 className="sr-only">Standings</h2>
        {divisions.length === 0 ? (
          <EmptyState
            icon={ListOrdered}
            title="No divisions set up yet"
            description="Standings show here once the organizer adds divisions."
          />
        ) : (
          <>
            {divisions.length > 1 && (
              <div className="grid gap-2 sm:w-72">
                <Label htmlFor="live-division">Division</Label>
                <Select
                  value={divisionId ?? undefined}
                  onValueChange={(v) => {
                    setDivisionId(v);
                    writeUrl("division", v);
                  }}
                >
                  <SelectTrigger id="live-division" className="w-full data-[size=default]:h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {divisions.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <DivisionStandings divisionId={divisionId} />
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}

const PIN = "sticky z-10 bg-card";

function DivisionStandings({ divisionId }: { divisionId: string | null }) {
  const { wods, rows, loading } = useDivisionStandings(divisionId);

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} data-testid="standings-skeleton" className="h-11 w-full" />
        ))}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No scored results yet. Standings fill in as heats are finished.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <Table className="[&_tr]:border-border">
        <TableHeader>
          <TableRow>
            <TableHead className={cn(PIN, "left-0 w-12 min-w-12")}>#</TableHead>
            <TableHead className={cn(PIN, "left-12 min-w-40")}>Athlete</TableHead>
            {wods.map((w) => (
              <TableHead key={w.id} className="text-center whitespace-nowrap">
                {w.name}
              </TableHead>
            ))}
            <TableHead className="text-right">Pts</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.key} className="h-11">
              <TableCell
                className={cn(PIN, "left-0 w-12 min-w-12 font-bold text-brand-text tabular-nums")}
              >
                {r.placement ?? "—"}
              </TableCell>
              <TableCell className={cn(PIN, "left-12 min-w-40 font-semibold whitespace-normal")}>
                {r.name}
              </TableCell>
              {wods.map((w) => {
                const p = r.wodPlacements[w.id];
                return (
                  <TableCell key={w.id} className="text-center text-muted-foreground tabular-nums">
                    {p ? ordinal(p) : "—"}
                  </TableCell>
                );
              })}
              <TableCell className="text-right font-semibold tabular-nums">
                {r.points ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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

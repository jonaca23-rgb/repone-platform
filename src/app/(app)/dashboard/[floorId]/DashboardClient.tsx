"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, ListOrdered } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { useBroadcastState } from "@/lib/realtime/useBroadcastState";
import { useLiveTimer } from "@/lib/realtime/useLiveTimer";
import { floorWatches } from "@/lib/realtime/floorWatches";
import { useRefreshOnChanges } from "@/lib/realtime/useRefreshOnChanges";
import { formatClock } from "@/lib/timer/compute";
import type { ActionResult } from "@/lib/action-result";
import { TimerDisplay } from "@/components/graphics/TimerDisplay";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  adjustTimer,
  clearGraphics,
  pauseTimer,
  resetTimer,
  resumeTimer,
  setActiveGraphic,
  setActiveSponsor,
  setCurrentHeat,
  setLowerThird,
  startTimer,
} from "@/lib/actions/broadcast";
import type { BroadcastSponsor } from "@/lib/db/sponsors";
import type { ActiveGraphic, Database } from "@/lib/db/database.types";
import { heatOnAir } from "@/lib/broadcast/heatOnAir";
import { OnAirBar } from "./OnAirBar";
import {
  GRAPHIC_LABEL,
  heatName,
  needsHeatSwitchConfirm,
  needsRestartConfirm,
  onAirSummary,
} from "./onAir";

export interface DashboardHeat {
  id: string;
  heatNumber: number;
  heatCount: number | null;
  wod: { id: string; name: string; scoring_type: string; time_cap_seconds: number | null };
  division: { id: string; name: string };
  lanes: Array<{
    laneNumber: number;
    athleteId: string | null;
    name: string | null;
    affiliate: string | null;
  }>;
}

type BroadcastStateRow = Database["public"]["Tables"]["broadcast_state"]["Row"];

const GRAPHICS: ActiveGraphic[] = ["heat_intro", "lanes", "wod", "timer", "score", "leaderboard"];

/** Live controls: 56px — big enough to hit mid-broadcast, small enough that the board fits a tablet. */
const LIVE = "min-h-14";

/**
 * A thrown error (network, server crash) has no message a production build
 * shows, so it names what failed; the detail is added in development.
 */
function failureMessage(what: string, e: unknown): string {
  const detail =
    process.env.NODE_ENV === "development" && e instanceof Error ? ` (${e.message})` : "";
  return `Couldn't ${what}. Check the connection and try again.${detail}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const id = `section-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <Card size="sm" role="region" aria-labelledby={id}>
      <CardHeader>
        <CardTitle>
          <h2
            id={id}
            className="text-xs font-semibold tracking-widest text-muted-foreground uppercase"
          >
            {title}
          </h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </Card>
  );
}

/**
 * The producer's live board for one floor. The On air bar says what the
 * audience sees; below it, "the floor" (heat and timer) on the left and "the
 * audience" (graphics, lower third, sponsors) on the right from lg. Only what
 * would hurt on air asks first: restarting a running clock, switching heats
 * while it runs, Reset and Clear all.
 */
export function DashboardClient({
  floorId,
  eventName,
  heats,
  initialBroadcastState,
  sponsors,
}: {
  floorId: string;
  eventId: string;
  eventName: string;
  heats: DashboardHeat[];
  initialBroadcastState: BroadcastStateRow | null;
  sponsors: BroadcastSponsor[];
}) {
  const { state, connected } = useBroadcastState(floorId, initialBroadcastState);
  useRefreshOnChanges(
    floorWatches(
      floorId,
      heats.map((h) => h.id),
    ),
  );
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<string | null>(null);
  const [countDirection, setCountDirection] = useState<"count_up" | "count_down">("count_down");
  const [lowerThirdAthlete, setLowerThirdAthlete] = useState<string>("");
  // The heat a switch confirmation is asking about, by id: a refresh can
  // reorder the list while the dialog is open.
  const [switchTo, setSwitchTo] = useState<string | null>(null);

  // With nothing on air yet, the first heat is shown with a "put on air"
  // control; see lib/broadcast/heatOnAir.ts.
  const { index, onAir } = useMemo(
    () => heatOnAir(heats, state?.current_heat_id ?? null),
    [heats, state?.current_heat_id],
  );
  const currentHeat = heats[index] ?? null;
  const summary = useMemo(() => onAirSummary(state, heats, sponsors), [state, heats, sponsors]);

  const timer = useLiveTimer({
    status: state?.timer_status ?? "idle",
    direction: state?.timer_direction ?? "count_down",
    durationSeconds: state?.timer_duration_seconds ?? 0,
    elapsedAtAnchor: state?.timer_elapsed_at_anchor ?? 0,
    anchorTimeMs: state?.timer_anchor_time ? new Date(state.timer_anchor_time).getTime() : null,
  });

  // Every one-tap control goes through here: "Sending…" shows while it runs,
  // and a failure — the server's own words, or a named one for a crash — stays
  // on screen until dismissed instead of vanishing mid-broadcast.
  function go(what: string, action: () => Promise<ActionResult>) {
    setFailure(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) setFailure(result.message);
      } catch (e) {
        unstable_rethrow(e);
        setFailure(failureMessage(what, e));
      }
    });
  }

  function putOnAir(i: number) {
    const heat = heats[i];
    if (heat) go(`switch to heat ${heat.heatNumber}`, () => setCurrentHeat(floorId, heat.id));
  }

  function requestHeat(i: number) {
    if (!heats[i]) return;
    if (needsHeatSwitchConfirm(state?.timer_status)) setSwitchTo(heats[i].id);
    else putOnAir(i);
  }

  if (!currentHeat) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <EmptyState
          icon={ListOrdered}
          title="No heats scheduled on this floor yet"
          description="Set them up in Admin → Heats & Lanes."
        />
      </div>
    );
  }

  const status = state?.timer_status ?? "idle";
  const paused = status === "paused";
  const athletesInHeat = currentHeat.lanes.filter((l) => l.athleteId);
  const duration =
    countDirection === "count_down"
      ? (currentHeat.wod.time_cap_seconds ?? 600)
      : (currentHeat.wod.time_cap_seconds ?? 0);
  const start = () => startTimer(floorId, countDirection, duration);
  const target = heats.find((h) => h.id === switchTo) ?? null;

  return (
    <div className="flex flex-col">
      <OnAirBar
        connected={connected}
        pending={pending}
        summary={summary}
        timerSeconds={timer.displaySeconds}
        offAirHeatNumber={onAir ? null : currentHeat.heatNumber}
        onPutOnAir={() => putOnAir(index)}
        onClear={() => clearGraphics(floorId)}
      />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4">
        <h1 className="sr-only">Production — {eventName}</h1>

        {failure && (
          <div
            role="alert"
            // Floats over the board instead of pushing it down: a failure is
            // exactly when the producer needs the timer row where it was.
            className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-xl items-center justify-between gap-3 rounded-xl border border-destructive bg-card px-5 py-2 text-sm shadow-2xl"
          >
            <span>{failure}</span>
            <Button variant="ghost" className="min-h-11 shrink-0" onClick={() => setFailure(null)}>
              Dismiss
            </Button>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* The floor */}
          <div className="flex flex-col gap-4">
            <Section title="Heat">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-xl font-bold tracking-wide uppercase">
                    {heatName(currentHeat)}
                  </p>
                  <p className="text-sm font-semibold tracking-wide text-brand-text uppercase">
                    {currentHeat.division.name}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="secondary"
                    className="size-14"
                    aria-label="Previous heat"
                    disabled={index <= 0}
                    onClick={() => requestHeat(index - 1)}
                  >
                    <ChevronLeft aria-hidden className="size-6" />
                  </Button>
                  <Button
                    variant="secondary"
                    className="size-14"
                    aria-label="Next heat"
                    disabled={index >= heats.length - 1}
                    onClick={() => requestHeat(index + 1)}
                  >
                    <ChevronRight aria-hidden className="size-6" />
                  </Button>
                </div>
              </div>
              <ul aria-label="Lanes" className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {currentHeat.lanes.map((lane) => (
                  <li
                    key={lane.laneNumber}
                    className="flex min-w-0 items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">
                      {lane.laneNumber}
                    </span>
                    <span className="truncate font-semibold">{lane.name ?? "—"}</span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Timer">
              <div className="flex flex-wrap items-center justify-center gap-4">
                <TimerDisplay seconds={timer.displaySeconds} atLimit={timer.atLimit} size="board" />
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="touch"
                  value={countDirection}
                  onValueChange={(v) => v && setCountDirection(v as "count_up" | "count_down")}
                  orientation="vertical"
                  spacing={0}
                  aria-label="Timer direction"
                  className="w-40"
                >
                  <ToggleGroupItem
                    value="count_down"
                    className="flex-1 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                  >
                    Count down
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="count_up"
                    className="flex-1 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                  >
                    Count up
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {needsRestartConfirm(status) ? (
                  <ConfirmAction
                    trigger="Start"
                    title="Restart the timer?"
                    description={`The clock is at ${formatClock(timer.displaySeconds)}. Restarting sets it back to the start, on the board and on air.`}
                    confirmLabel="Restart timer"
                    variant="default"
                    triggerVariant="default"
                    triggerSize="touch"
                    triggerClassName={LIVE}
                    onConfirm={start}
                  />
                ) : (
                  <Button
                    size="touch"
                    className={LIVE}
                    onClick={() => go("start the timer", start)}
                  >
                    Start
                  </Button>
                )}
                <Button
                  size="touch"
                  variant="secondary"
                  className={LIVE}
                  onClick={() =>
                    go(paused ? "resume the timer" : "pause the timer", () =>
                      paused ? resumeTimer(floorId) : pauseTimer(floorId),
                    )
                  }
                >
                  {paused ? "Resume" : "Pause"}
                </Button>
                <ConfirmAction
                  trigger="Reset"
                  title="Reset the timer?"
                  description="The clock goes back to zero and stops, on the dashboard and on air."
                  confirmLabel="Reset timer"
                  variant="default"
                  triggerVariant="secondary"
                  triggerSize="touch"
                  triggerClassName={LIVE}
                  onConfirm={() => resetTimer(floorId)}
                />
                <Button
                  size="touch"
                  variant="secondary"
                  className={LIVE}
                  onClick={() => go("adjust the timer", () => adjustTimer(floorId, -10))}
                >
                  −10s
                </Button>
                <Button
                  size="touch"
                  variant="secondary"
                  className={LIVE}
                  onClick={() => go("adjust the timer", () => adjustTimer(floorId, 10))}
                >
                  +10s
                </Button>
              </div>
            </Section>
          </div>

          {/* The audience */}
          <div className="flex flex-col gap-4">
            <Section title="Graphics">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {GRAPHICS.map((g) => {
                  const pressed = state?.active_graphic === g;
                  return (
                    <Button
                      key={g}
                      size="touch"
                      variant={pressed ? "default" : "secondary"}
                      aria-pressed={pressed}
                      className={cn(LIVE, "h-auto px-3 whitespace-normal")}
                      onClick={() =>
                        go(`show ${GRAPHIC_LABEL[g].toLowerCase()}`, () =>
                          setActiveGraphic(floorId, g),
                        )
                      }
                    >
                      Show {GRAPHIC_LABEL[g]}
                    </Button>
                  );
                })}
              </div>
            </Section>

            <Section title="Lower third">
              <div className="flex flex-wrap items-end gap-3">
                <div className="grid min-w-48 flex-1 gap-2">
                  <Label htmlFor="lower-third-athlete">Lower third athlete</Label>
                  <Select value={lowerThirdAthlete} onValueChange={setLowerThirdAthlete}>
                    <SelectTrigger
                      id="lower-third-athlete"
                      className="w-full data-[size=default]:h-12"
                    >
                      <SelectValue placeholder="Select athlete…" />
                    </SelectTrigger>
                    <SelectContent>
                      {athletesInHeat.map((l) => (
                        <SelectItem key={l.laneNumber} value={l.athleteId!}>
                          Lane {l.laneNumber} — {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="touch"
                  className={LIVE}
                  disabled={!lowerThirdAthlete}
                  onClick={() =>
                    go("show the lower third", () => setLowerThird(floorId, lowerThirdAthlete))
                  }
                >
                  Show
                </Button>
                <Button
                  size="touch"
                  variant="secondary"
                  className={LIVE}
                  onClick={() => go("hide the lower third", () => setLowerThird(floorId, null))}
                >
                  Hide
                </Button>
              </div>
            </Section>

            <Section title="Sponsors">
              {sponsors.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {sponsors.map((s) => {
                    const pressed = state?.active_sponsor_id === s.id;
                    return (
                      <Button
                        key={s.id}
                        size="touch"
                        variant={pressed ? "default" : "secondary"}
                        aria-pressed={pressed}
                        className={cn(LIVE, "h-auto px-3 whitespace-normal")}
                        onClick={() =>
                          go(`toggle ${s.business_name}`, () =>
                            setActiveSponsor(floorId, pressed ? null : s.id),
                          )
                        }
                      >
                        {s.business_name}
                      </Button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No active sponsors for this event.</p>
              )}
            </Section>
          </div>
        </div>
      </div>

      <ConfirmAction
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setSwitchTo(null);
        }}
        title={target ? `Switch to Heat ${target.heatNumber}?` : ""}
        description={`The timer is ${paused ? "paused" : "running"} for Heat ${currentHeat.heatNumber}. Switching heats doesn't stop it.`}
        confirmLabel="Switch heat"
        variant="default"
        onConfirm={async () => (target ? setCurrentHeat(floorId, target.id) : undefined)}
      />
    </div>
  );
}

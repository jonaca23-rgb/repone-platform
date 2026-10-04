"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, ListOrdered } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { useBroadcastState } from "@/lib/realtime/useBroadcastState";
import { useLiveTimer } from "@/lib/realtime/useLiveTimer";
import { floorWatches } from "@/lib/realtime/floorWatches";
import { useRefreshOnChanges } from "@/lib/realtime/useRefreshOnChanges";
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
import { cn } from "@/lib/utils";
import {
  setCurrentHeat,
  setActiveGraphic,
  setLowerThird,
  setActiveSponsor,
  clearGraphics,
  startTimer,
  pauseTimer,
  resumeTimer,
  resetTimer,
  adjustTimer,
} from "@/lib/actions/broadcast";
import type { ActiveGraphic, Database } from "@/lib/db/database.types";
import { heatOnAir } from "@/lib/broadcast/heatOnAir";

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

const GRAPHIC_BUTTONS: Array<{ key: ActiveGraphic; label: string }> = [
  { key: "heat_intro", label: "Heat Intro" },
  { key: "lanes", label: "Lanes" },
  { key: "wod", label: "WOD" },
  { key: "timer", label: "Timer" },
  { key: "score", label: "Score" },
  { key: "leaderboard", label: "Leaderboard" },
];

/** Live controls: 64px tall so they're hard to miss on a tablet mid-broadcast. */
const LIVE = "min-h-16";

/**
 * Production builds hide server error text, so the message names what failed;
 * the detail is added in development.
 */
function failureMessage(what: string, e: unknown): string {
  const detail =
    process.env.NODE_ENV === "development" && e instanceof Error ? ` (${e.message})` : "";
  return `Couldn't ${what}. Check the connection and try again.${detail}`;
}

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const id = `section-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <Card size="sm" role="region" aria-labelledby={id} className={className}>
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
      <CardContent>{children}</CardContent>
    </Card>
  );
}

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
  sponsors: Array<{ id: string; business_name: string; tier: string }>;
}) {
  const { state, connected } = useBroadcastState(floorId, initialBroadcastState);
  useRefreshOnChanges(
    floorWatches(
      floorId,
      heats.map((h) => h.id),
    ),
  );
  const [pending, startTransitionFn] = useTransition();
  const [failure, setFailure] = useState<string | null>(null);
  const [countDirection, setCountDirection] = useState<"count_up" | "count_down">("count_down");

  // With nothing on air yet, the first heat is shown with a "put on air"
  // control; see lib/broadcast/heatOnAir.ts.
  const { index: effectiveIndex, onAir } = useMemo(
    () => heatOnAir(heats, state?.current_heat_id ?? null),
    [heats, state?.current_heat_id],
  );
  const currentHeat = heats[effectiveIndex] ?? null;

  const [lowerThirdAthlete, setLowerThirdAthlete] = useState<string>("");

  const timer = useLiveTimer({
    status: state?.timer_status ?? "idle",
    direction: state?.timer_direction ?? "count_down",
    durationSeconds: state?.timer_duration_seconds ?? 0,
    elapsedAtAnchor: state?.timer_elapsed_at_anchor ?? 0,
    anchorTimeMs: state?.timer_anchor_time ? new Date(state.timer_anchor_time).getTime() : null,
  });

  // Every one-tap control goes through here: the action is awaited,
  // "Sending…" shows while it runs, and a failure is shown to the operator
  // instead of vanishing mid-broadcast.
  function go(what: string, action: () => Promise<unknown>) {
    setFailure(null);
    startTransitionFn(async () => {
      try {
        const result = await action();
        if (result && typeof result === "object" && "ok" in result && !result.ok) {
          setFailure(String((result as unknown as { message: unknown }).message));
        }
      } catch (e) {
        setFailure(failureMessage(what, e));
      }
    });
  }

  // The confirmed controls (Reset, Clear graphics) run inside the dialog,
  // which stays open and shows the same message as a toast on failure.
  function confirmed(what: string, action: () => Promise<unknown>) {
    return async () => {
      setFailure(null);
      try {
        return await action();
      } catch (e) {
        // A redirect or notFound is Next's to handle; ConfirmAction rethrows it too.
        unstable_rethrow(e);
        throw new Error(failureMessage(what, e));
      }
    };
  }

  function selectHeat(index: number) {
    const heat = heats[index];
    if (!heat) return;
    go(`switch to heat ${heat.heatNumber}`, () => setCurrentHeat(floorId, heat.id));
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

  const paused = state?.timer_status === "paused";
  const athletesInHeat = currentHeat.lanes.filter((l) => l.athleteId);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:gap-6 sm:py-6">
      {/* Header */}
      <Card size="sm">
        <CardContent className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs tracking-widest text-muted-foreground uppercase">{eventName}</p>
            <h1 className="font-display text-2xl font-bold tracking-wide uppercase">
              {currentHeat.wod.name} · Heat {currentHeat.heatNumber}
              {currentHeat.heatCount ? ` / ${currentHeat.heatCount}` : ""}
            </h1>
            <p className="text-sm font-semibold tracking-wide text-brand-text uppercase">
              {currentHeat.division.name}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs tracking-wide uppercase">
            <span role="status" aria-live="polite" className="text-muted-foreground">
              {pending ? "Sending…" : ""}
            </span>
            <span
              role="status"
              aria-live="polite"
              className={cn(
                "flex items-center gap-2 font-semibold",
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
          </div>
        </CardContent>
      </Card>

      {failure && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-destructive/50 bg-destructive/10 px-5 py-2 text-sm"
        >
          <span>{failure}</span>
          <Button variant="ghost" className="min-h-11 shrink-0" onClick={() => setFailure(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {!onAir && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary bg-primary/10 px-5 py-4">
          <span className="font-semibold">
            No heat is on air. Overlays show nothing until one is.
          </span>
          <Button size="touch" className={LIVE} onClick={() => selectHeat(effectiveIndex)}>
            Put Heat {currentHeat.heatNumber} on air
          </Button>
        </div>
      )}

      {/* Heat nav */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          size="touch"
          variant="secondary"
          className={cn(LIVE, "gap-2")}
          disabled={effectiveIndex <= 0}
          onClick={() => selectHeat(Math.max(0, effectiveIndex - 1))}
        >
          <ChevronLeft aria-hidden />
          Previous heat
        </Button>
        <Button
          size="touch"
          variant="secondary"
          className={cn(LIVE, "gap-2")}
          disabled={effectiveIndex >= heats.length - 1}
          onClick={() => selectHeat(Math.min(heats.length - 1, effectiveIndex + 1))}
        >
          Next heat
          <ChevronRight aria-hidden />
        </Button>
      </div>

      {/* Lanes */}
      <ul aria-label="Lanes" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {currentHeat.lanes.map((lane) => (
          <li
            key={lane.laneNumber}
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded bg-primary font-bold text-primary-foreground">
              {lane.laneNumber}
            </span>
            <span className="truncate font-semibold uppercase">{lane.name ?? "—"}</span>
          </li>
        ))}
      </ul>

      <Section title="Timer">
        <div className="flex justify-center">
          <TimerDisplay seconds={timer.displaySeconds} atLimit={timer.atLimit} />
        </div>
        <div role="group" aria-label="Timer direction" className="flex justify-center gap-2">
          {(["count_down", "count_up"] as const).map((d) => (
            <Button
              key={d}
              size="touch"
              variant={countDirection === d ? "default" : "secondary"}
              aria-pressed={countDirection === d}
              onClick={() => setCountDirection(d)}
            >
              {d === "count_down" ? "Count down" : "Count up"}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Button
            size="touch"
            className={LIVE}
            onClick={() =>
              go("start the timer", () =>
                startTimer(
                  floorId,
                  countDirection,
                  countDirection === "count_down"
                    ? (currentHeat.wod.time_cap_seconds ?? 600)
                    : (currentHeat.wod.time_cap_seconds ?? 0),
                ),
              )
            }
          >
            Start
          </Button>
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
            onConfirm={confirmed("reset the timer", () => resetTimer(floorId))}
          />
          <div className="flex gap-2">
            <Button
              size="touch"
              variant="secondary"
              className={cn(LIVE, "flex-1 px-2")}
              onClick={() => go("adjust the timer", () => adjustTimer(floorId, -10))}
            >
              −10s
            </Button>
            <Button
              size="touch"
              variant="secondary"
              className={cn(LIVE, "flex-1 px-2")}
              onClick={() => go("adjust the timer", () => adjustTimer(floorId, 10))}
            >
              +10s
            </Button>
          </div>
        </div>
      </Section>

      <Section title="Graphics">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {GRAPHIC_BUTTONS.map((g) => {
            const pressed = state?.active_graphic === g.key;
            return (
              <Button
                key={g.key}
                size="touch"
                variant={pressed ? "default" : "secondary"}
                aria-pressed={pressed}
                className={cn(LIVE, "h-auto px-3 whitespace-normal")}
                onClick={() =>
                  go(`show ${g.label.toLowerCase()}`, () => setActiveGraphic(floorId, g.key))
                }
              >
                Show {g.label}
              </Button>
            );
          })}
          <div className="col-span-2 grid sm:col-span-3">
            <ConfirmAction
              trigger="Clear graphics"
              title="Clear all graphics from air?"
              description="The graphic, the lower third and the sponsor all come off the program output."
              confirmLabel="Clear graphics"
              variant="default"
              triggerVariant="outline"
              triggerSize="touch"
              triggerClassName={LIVE}
              onConfirm={confirmed("clear the graphics", () => clearGraphics(floorId))}
            />
          </div>
        </div>
      </Section>

      <Section title="Lower third">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid min-w-56 flex-1 gap-2">
            <Label htmlFor="lower-third-athlete">Lower third athlete</Label>
            <Select value={lowerThirdAthlete} onValueChange={setLowerThirdAthlete}>
              <SelectTrigger id="lower-third-athlete" className="w-full data-[size=default]:h-12">
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
  );
}

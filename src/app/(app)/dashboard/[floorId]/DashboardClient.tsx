"use client";

import { useMemo, useState, useTransition } from "react";
import { useBroadcastState } from "@/lib/realtime/useBroadcastState";
import { useLiveTimer } from "@/lib/realtime/useLiveTimer";
import { TimerDisplay } from "@/components/graphics/TimerDisplay";
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

export function DashboardClient({
  floorId,
  eventId,
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
  const [, startTransitionFn] = useTransition();
  const [countDirection, setCountDirection] = useState<"count_up" | "count_down">("count_down");

  const currentIndex = useMemo(
    () => heats.findIndex((h) => h.id === state?.current_heat_id),
    [heats, state?.current_heat_id],
  );
  // A fresh floor's broadcast_state.current_heat_id starts out null — nothing
  // has explicitly selected a heat yet. Treat heat #1 as implicitly current
  // in that case (matches what's actually displayed below) so Previous/Next
  // navigation has a starting point instead of staying disabled forever with
  // no way to select any heat at all.
  const effectiveIndex = currentIndex >= 0 ? currentIndex : 0;
  const currentHeat = heats[effectiveIndex] ?? null;

  const [lowerThirdAthlete, setLowerThirdAthlete] = useState<string>("");

  const timer = useLiveTimer({
    status: state?.timer_status ?? "idle",
    direction: state?.timer_direction ?? "count_down",
    durationSeconds: state?.timer_duration_seconds ?? 0,
    elapsedAtAnchor: state?.timer_elapsed_at_anchor ?? 0,
    anchorTimeMs: state?.timer_anchor_time ? new Date(state.timer_anchor_time).getTime() : null,
  });

  function go(action: () => Promise<unknown>) {
    startTransitionFn(() => {
      action();
    });
  }

  function selectHeat(index: number) {
    const heat = heats[index];
    if (!heat) return;
    go(() => setCurrentHeat(floorId, heat.id, eventId));
  }

  if (!currentHeat) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-6 text-center text-white/60">
        No heats scheduled on this floor yet. Set them up in Admin → Heats & Lanes.
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-repone-gray px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-white/50">{eventName}</p>
          <p className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-wide">
            {currentHeat.wod.name} · Heat {currentHeat.heatNumber}
            {currentHeat.heatCount ? ` / ${currentHeat.heatCount}` : ""}
          </p>
          <p className="text-sm font-semibold uppercase tracking-wide text-repone-red">
            {currentHeat.division.name}
          </p>
        </div>
        <span
          className={`h-3 w-3 rounded-full ${connected ? "bg-green-500" : "bg-repone-red animate-pulse"}`}
          title={connected ? "Live" : "Reconnecting…"}
        />
      </div>

      {/* Heat nav */}
      <div className="grid grid-cols-2 gap-3">
        <button
          className="control-btn"
          disabled={effectiveIndex <= 0}
          onClick={() => selectHeat(Math.max(0, effectiveIndex - 1))}
        >
          ← Previous Heat
        </button>
        <button
          className="control-btn"
          disabled={effectiveIndex >= heats.length - 1}
          onClick={() => selectHeat(Math.min(heats.length - 1, effectiveIndex + 1))}
        >
          Next Heat →
        </button>
      </div>

      {/* Lanes */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {currentHeat.lanes.map((lane) => (
          <div
            key={lane.laneNumber}
            className="flex items-center gap-3 rounded-lg bg-repone-gray px-4 py-3"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-repone-red font-bold">
              {lane.laneNumber}
            </span>
            <span className="truncate font-semibold uppercase">{lane.name ?? "—"}</span>
          </div>
        ))}
      </div>

      {/* Timer */}
      <div className="rounded-xl bg-repone-gray p-5">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-white/50">Timer</p>
        <div className="mb-4 flex justify-center">
          <TimerDisplay seconds={timer.displaySeconds} atLimit={timer.atLimit} />
        </div>
        <div className="mb-3 flex justify-center gap-2 text-xs">
          {(["count_down", "count_up"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setCountDirection(d)}
              className={`rounded-full px-3 py-1 font-semibold uppercase ${
                countDirection === d ? "bg-repone-red" : "bg-white/10 text-white/60"
              }`}
            >
              {d === "count_down" ? "Count Down" : "Count Up"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <button
            className="control-btn control-btn-red"
            onClick={() =>
              go(() =>
                startTimer(
                  floorId,
                  countDirection,
                  countDirection === "count_down"
                    ? (currentHeat.wod.time_cap_seconds ?? 600)
                    : (currentHeat.wod.time_cap_seconds ?? 0),
                  eventId,
                ),
              )
            }
          >
            Start
          </button>
          <button
            className="control-btn"
            onClick={() =>
              go(() =>
                state?.timer_status === "paused"
                  ? resumeTimer(floorId, eventId)
                  : pauseTimer(floorId, eventId),
              )
            }
          >
            {state?.timer_status === "paused" ? "Resume" : "Pause"}
          </button>
          <button className="control-btn" onClick={() => go(() => resetTimer(floorId, eventId))}>
            Reset
          </button>
          <div className="flex gap-2">
            <button
              className="control-btn flex-1"
              onClick={() => go(() => adjustTimer(floorId, -10, eventId))}
            >
              −10s
            </button>
            <button
              className="control-btn flex-1"
              onClick={() => go(() => adjustTimer(floorId, 10, eventId))}
            >
              +10s
            </button>
          </div>
        </div>
      </div>

      {/* Graphics */}
      <div className="rounded-xl bg-repone-gray p-5">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-white/50">Graphics</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {GRAPHIC_BUTTONS.map((g) => (
            <button
              key={g.key}
              className={`control-btn ${state?.active_graphic === g.key ? "control-btn-red" : ""}`}
              onClick={() => go(() => setActiveGraphic(floorId, g.key, eventId))}
            >
              Show {g.label}
            </button>
          ))}
          <button
            className="control-btn control-btn-outline border-white/30 !bg-transparent !text-white col-span-2 sm:col-span-3"
            onClick={() => go(() => clearGraphics(floorId, eventId))}
          >
            Clear Graphics
          </button>
        </div>
      </div>

      {/* Lower third */}
      <div className="rounded-xl bg-repone-gray p-5">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-white/50">
          Lower Third
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={lowerThirdAthlete}
            onChange={(e) => setLowerThirdAthlete(e.target.value)}
            className="flex-1 rounded-md border border-white/20 bg-black/40 px-3 py-3 text-white"
          >
            <option value="">Select athlete…</option>
            {currentHeat.lanes
              .filter((l) => l.athleteId)
              .map((l) => (
                <option key={l.laneNumber} value={l.athleteId!}>
                  Lane {l.laneNumber} — {l.name}
                </option>
              ))}
          </select>
          <button
            className="control-btn control-btn-red w-fit px-6"
            disabled={!lowerThirdAthlete}
            onClick={() => go(() => setLowerThird(floorId, lowerThirdAthlete, eventId))}
          >
            Show
          </button>
          <button
            className="control-btn w-fit px-6"
            onClick={() => go(() => setLowerThird(floorId, null, eventId))}
          >
            Hide
          </button>
        </div>
      </div>

      {/* Sponsors */}
      <div className="rounded-xl bg-repone-gray p-5">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-white/50">Sponsors</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {sponsors.map((s) => (
            <button
              key={s.id}
              className={`control-btn ${state?.active_sponsor_id === s.id ? "control-btn-red" : ""}`}
              onClick={() =>
                go(() =>
                  setActiveSponsor(
                    floorId,
                    state?.active_sponsor_id === s.id ? null : s.id,
                    eventId,
                  ),
                )
              }
            >
              {s.business_name}
            </button>
          ))}
          {sponsors.length === 0 && (
            <p className="text-sm text-white/40">No active sponsors for this event.</p>
          )}
        </div>
      </div>
    </div>
  );
}

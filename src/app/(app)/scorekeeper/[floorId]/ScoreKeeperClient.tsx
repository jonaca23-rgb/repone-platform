"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { useBroadcastState } from "@/lib/realtime/useBroadcastState";
import { enterResult } from "@/lib/actions/results";
import { finishHeat } from "@/lib/actions/heats";
import { formatClock } from "@/lib/timer/compute";
import type { Database } from "@/lib/db/database.types";

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

export interface ScoreKeeperResult {
  athlete_id: string | null;
  time_seconds: number | null;
  reps: number | null;
  load: number | null;
  points: number | null;
  capped: boolean;
  status: "completed" | "dns" | "dnf" | "dq";
  tiebreak_value: number | null;
  manually_adjusted: boolean;
}

export interface ScoreKeeperStanding {
  placement: number | null;
  points: number | null;
  athlete_id: string | null;
  name: string;
}

type BroadcastStateRow = Database["public"]["Tables"]["broadcast_state"]["Row"];

// Separate component so `useFormStatus` can read the enclosing <form>'s
// pending state — disables the button to guard against double-submission
// while a save is in flight (reliability requirement from the platform spec).
function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button className="control-btn control-btn-red px-6 py-3 text-base" disabled={pending}>
      {pending ? "Saving…" : "Save Score"}
    </button>
  );
}

// Same guard-against-double-submission pattern as SaveButton, for the
// "Save all & Finish Heat" button below.
function FinishHeatButton({ alreadyFinished }: { alreadyFinished: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      className="control-btn control-btn-red px-6 py-3 text-base"
      disabled={pending || alreadyFinished}
    >
      {alreadyFinished ? "Heat Finished ✓" : pending ? "Finishing…" : "Save all & Finish Heat"}
    </button>
  );
}

export function ScoreKeeperClient({
  floorId,
  eventId,
  eventName,
  heats,
  initialBroadcastState,
  resultsByHeatId,
  standingsByHeatId,
}: {
  floorId: string;
  eventId: string;
  eventName: string;
  heats: ScoreKeeperHeat[];
  initialBroadcastState: BroadcastStateRow | null;
  resultsByHeatId: Record<string, ScoreKeeperResult[]>;
  standingsByHeatId: Record<string, ScoreKeeperStanding[]>;
}) {
  const { state, connected } = useBroadcastState(floorId, initialBroadcastState);
  const liveHeatId = state?.current_heat_id ?? null;

  // By default the scorekeeper's screen follows whatever heat Production has
  // live on the Dashboard (heat/lane automation from the spec) — but they can
  // switch to any heat manually (e.g. to fix an earlier score) without losing
  // that live link; "Follow Live Heat" brings them back to it.
  const [following, setFollowing] = useState(true);
  const [manualHeatId, setManualHeatId] = useState<string | null>(null);

  const activeHeatId = following
    ? (liveHeatId ?? heats[0]?.id ?? null)
    : (manualHeatId ?? heats[0]?.id ?? null);
  const heat = heats.find((h) => h.id === activeHeatId) ?? heats[0] ?? null;

  // Manual "Previous Heat" / "Next Heat" step through this floor's heats in
  // the same order as the picker above — steps off "Follow Live Heat" the
  // same way picking a heat from the dropdown does.
  const heatIndex = heat ? heats.findIndex((h) => h.id === heat.id) : -1;
  const goToHeat = (id: string) => {
    setFollowing(false);
    setManualHeatId(id);
  };

  const resultByAthlete = useMemo(() => {
    const map = new Map<string, ScoreKeeperResult>();
    (heat ? (resultsByHeatId[heat.id] ?? []) : []).forEach((r) => {
      if (r.athlete_id) map.set(r.athlete_id, r);
    });
    return map;
  }, [heat, resultsByHeatId]);

  const standings = heat ? (standingsByHeatId[heat.id] ?? []) : [];

  if (!heat) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-6 text-center text-white/60">
        No heats scheduled on this floor yet — set them up in Admin → Heats & Lanes.
      </div>
    );
  }

  const scoringType = heat.wod.scoring_type as
    | "for_time"
    | "amrap"
    | "max_load"
    | "points"
    | "other";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-repone-gray px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-white/50">{eventName}</p>
          <p className="flex items-center gap-2 font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-wide">
            {heat.wod.name} · Heat {heat.heatNumber}
            {heat.heatCount ? ` / ${heat.heatCount}` : ""}
            {heat.endedAt && (
              <span className="rounded-full bg-green-600/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-400">
                ✓ Finished
              </span>
            )}
          </p>
          <p className="text-sm font-semibold uppercase tracking-wide text-repone-red">
            {heat.division.name}
          </p>
        </div>
        <span
          className={`h-3 w-3 rounded-full ${connected ? "bg-green-500" : "bg-repone-red animate-pulse"}`}
          title={connected ? "Live" : "Reconnecting…"}
        />
      </div>

      {/* Heat picker */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-repone-gray px-5 py-4">
        <label className="flex flex-1 flex-col gap-1 text-xs uppercase tracking-wide text-white/50">
          Heat
          <select
            value={heat.id}
            onChange={(e) => {
              setFollowing(false);
              setManualHeatId(e.target.value);
            }}
            className="rounded-md border border-white/20 bg-black/40 px-3 py-3 text-white"
          >
            {heats.map((h) => (
              <option key={h.id} value={h.id}>
                {h.wod.name} — Heat {h.heatNumber} ({h.division.name})
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="control-btn w-fit px-4 py-3 text-xs disabled:opacity-30"
            disabled={heatIndex <= 0}
            onClick={() => heatIndex > 0 && goToHeat(heats[heatIndex - 1].id)}
          >
            ← Previous Heat
          </button>
          <button
            type="button"
            className="control-btn w-fit px-4 py-3 text-xs disabled:opacity-30"
            disabled={heatIndex === -1 || heatIndex >= heats.length - 1}
            onClick={() =>
              heatIndex >= 0 && heatIndex < heats.length - 1 && goToHeat(heats[heatIndex + 1].id)
            }
          >
            Next Heat →
          </button>
        </div>
        {following ? (
          <span className="text-xs font-semibold uppercase tracking-wide text-repone-red">
            Following live heat
          </span>
        ) : (
          <button
            className="control-btn w-fit px-4 py-3 text-xs"
            onClick={() => {
              setFollowing(true);
              setManualHeatId(null);
            }}
          >
            Follow Live Heat
          </button>
        )}
      </div>

      {/* Score entry — one card per lane, matching the judge's scorecard fields for this WOD's scoring type */}
      <div className="flex flex-col gap-3">
        {heat.lanes
          .filter((l) => l.athleteId)
          .map((lane) => {
            const existing = resultByAthlete.get(lane.athleteId!);
            return (
              <form
                key={lane.laneNumber}
                action={enterResult.bind(
                  null,
                  eventId,
                  heat.id,
                  heat.wod.id,
                  heat.division.id,
                  scoringType,
                  floorId,
                )}
                className="rounded-xl bg-repone-gray p-4"
              >
                <input type="hidden" name="competitor_type" value="athlete" />
                <input type="hidden" name="competitor_id" value={lane.athleteId ?? ""} />
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-semibold uppercase tracking-wide">
                    <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded bg-repone-red text-sm font-bold">
                      {lane.laneNumber}
                    </span>
                    {lane.name}
                  </p>
                  <span className="flex items-center gap-2">
                    {existing && (
                      <span className="text-xs font-semibold uppercase tracking-wide text-green-400">
                        ✓ Recorded
                      </span>
                    )}
                    {existing?.manually_adjusted && (
                      <span className="text-xs font-semibold uppercase tracking-wide text-amber-400">
                        ✎ Adjusted
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  {scoringType === "for_time" && (
                    <>
                      <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-white/50">
                        Time (mm:ss)
                        <input
                          name="time_seconds"
                          type="text"
                          inputMode="decimal"
                          pattern="[0-9]+:[0-5]?[0-9](\.[0-9]+)?|[0-9]+(\.[0-9]+)?"
                          placeholder="3:45"
                          defaultValue={
                            existing?.time_seconds != null ? formatClock(existing.time_seconds) : ""
                          }
                          className="w-32 rounded-md border border-white/20 bg-black/40 px-3 py-3 text-white"
                        />
                      </label>
                      <label className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/50">
                        <input
                          name="capped"
                          type="checkbox"
                          defaultChecked={existing?.capped ?? false}
                          className="h-5 w-5"
                        />
                        Time-capped
                      </label>
                      <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-white/50">
                        Reps (if capped)
                        <input
                          name="reps"
                          type="number"
                          inputMode="numeric"
                          defaultValue={existing?.reps ?? ""}
                          className="w-28 rounded-md border border-white/20 bg-black/40 px-3 py-3 text-white"
                        />
                      </label>
                    </>
                  )}
                  {scoringType === "amrap" && (
                    <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-white/50">
                      Total reps
                      <input
                        name="reps"
                        type="number"
                        inputMode="numeric"
                        defaultValue={existing?.reps ?? ""}
                        className="w-28 rounded-md border border-white/20 bg-black/40 px-3 py-3 text-white"
                      />
                    </label>
                  )}
                  {scoringType === "max_load" && (
                    <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-white/50">
                      Load
                      <input
                        name="load"
                        type="number"
                        step="0.5"
                        inputMode="decimal"
                        defaultValue={existing?.load ?? ""}
                        className="w-28 rounded-md border border-white/20 bg-black/40 px-3 py-3 text-white"
                      />
                    </label>
                  )}
                  {(scoringType === "points" || scoringType === "other") && (
                    <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-white/50">
                      Points
                      <input
                        name="points"
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        defaultValue={existing?.points ?? ""}
                        className="w-28 rounded-md border border-white/20 bg-black/40 px-3 py-3 text-white"
                      />
                    </label>
                  )}
                  <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-white/50">
                    Tie-break
                    <input
                      name="tiebreak_value"
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      defaultValue={existing?.tiebreak_value ?? ""}
                      className="w-28 rounded-md border border-white/20 bg-black/40 px-3 py-3 text-white"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-white/50">
                    Status
                    <select
                      name="status"
                      defaultValue={existing?.status ?? "completed"}
                      className="rounded-md border border-white/20 bg-black/40 px-3 py-3 text-white"
                    >
                      <option value="completed">Completed</option>
                      <option value="dnf">DNF</option>
                      <option value="dns">DNS</option>
                      <option value="dq">DQ</option>
                    </select>
                  </label>
                  <label
                    className="flex items-center gap-2 text-xs uppercase tracking-wide text-amber-400"
                    title="Check this when correcting a result after the fact (e.g. a claim/protest resolved after the heat) — the record will be marked as manually adjusted."
                  >
                    <input
                      name="manual_adjustment"
                      type="checkbox"
                      defaultChecked={existing?.manually_adjusted ?? false}
                      className="h-5 w-5"
                    />
                    Manual Adjustment
                  </label>
                  <SaveButton />
                </div>
              </form>
            );
          })}
        {heat.lanes.filter((l) => l.athleteId).length === 0 && (
          <p className="text-sm text-white/50">
            No athletes assigned to lanes for this heat yet — set that up in Admin → Heats & Lanes.
          </p>
        )}
      </div>

      {/* Finish this heat — scores above are already saved lane by lane as
          they're entered; this just flips the heat's status once every lane
          is done, which is what marks it "✓ Completed" back on the Heats &
          Lanes list. Heats & Lanes' own "Save All" button no longer does
          this — only this button does. */}
      {heat.lanes.filter((l) => l.athleteId).length > 0 && (
        <form
          action={finishHeat.bind(null, eventId, heat.id, floorId)}
          onSubmit={(e) => {
            if (
              !window.confirm(
                `Finish Heat ${heat.heatNumber} — ${heat.wod.name} (${heat.division.name})? It will be marked Completed on Heats & Lanes.`,
              )
            ) {
              e.preventDefault();
            }
          }}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-repone-gray px-5 py-4"
        >
          <p className="text-xs uppercase tracking-wide text-white/50">
            {heat.endedAt
              ? "This heat is marked completed."
              : "Once every lane's result is entered above, finish this heat."}
          </p>
          <FinishHeatButton alreadyFinished={Boolean(heat.endedAt)} />
        </form>
      )}

      {/* Live leaderboard for this heat's WOD/division — updates the moment a score is saved */}
      {standings.length > 0 && (
        <div className="rounded-xl bg-repone-gray p-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-white/50">
            Live Leaderboard — {heat.wod.name} ({heat.division.name})
          </p>
          <div className="flex flex-col gap-1">
            {standings.map((s, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-black/30 px-4 py-2 text-sm"
              >
                <span>
                  <span className="mr-3 font-bold text-repone-red">{s.placement ?? "—"}</span>
                  {s.name}
                </span>
                <span className="font-semibold">{s.points ?? "—"} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

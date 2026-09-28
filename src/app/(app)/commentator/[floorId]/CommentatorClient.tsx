"use client";

import { useState } from "react";
import Link from "next/link";
import { useBroadcastState } from "@/lib/realtime/useBroadcastState";
import type { FloorHeat } from "@/lib/db/queries";
import type { Database } from "@/lib/db/database.types";
import type { CommentatorAthleteDetails } from "@/lib/db/commentator";

type BroadcastStateRow = Database["public"]["Tables"]["broadcast_state"]["Row"];

// Read-only, tablet-first view for whoever is on the mic: current heat,
// who's in it, and enough of their stats/history to talk about them without
// needing a second screen. Follows the live heat the same way Score
// Keeper/every overlay does, with the same manual override + "Follow Live
// Heat" recovery, so a commentator can jump ahead to preview the next heat
// while the current one is still running and get back on track with one tap.
export function CommentatorClient({
  floorId,
  eventName,
  heats,
  initialBroadcastState,
  detailsByAthleteId,
  hideBackLink = false,
}: {
  floorId: string;
  eventName: string;
  heats: FloorHeat[];
  initialBroadcastState: BroadcastStateRow | null;
  detailsByAthleteId: Record<string, CommentatorAthleteDetails>;
  // The event-scoped Commentator dashboard
  // (commentator/events/[eventId]/dashboard/EventCommentatorDashboard.tsx)
  // embeds this component directly and already provides its own "← Choose a
  // different event" nav one level up, plus floor tabs when an event has
  // more than one floor — so the standalone "← Choose a different floor"
  // link below (which points at the old top-level /commentator picker)
  // would be a confusing, event-context-losing detour there. Defaults to
  // false so the original standalone /commentator/[floorId] route's
  // behavior is unchanged.
  hideBackLink?: boolean;
}) {
  const { state, connected } = useBroadcastState(floorId, initialBroadcastState);
  const liveHeatId = state?.current_heat_id ?? null;

  const [following, setFollowing] = useState(true);
  const [manualHeatId, setManualHeatId] = useState<string | null>(null);

  const activeHeatId = following ? liveHeatId ?? heats[0]?.id ?? null : manualHeatId ?? heats[0]?.id ?? null;
  const heat = heats.find((h) => h.id === activeHeatId) ?? heats[0] ?? null;

  const heatIndex = heat ? heats.findIndex((h) => h.id === heat.id) : -1;
  const goToHeat = (id: string) => {
    setFollowing(false);
    setManualHeatId(id);
  };

  if (!heat) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center gap-4 px-6 text-center text-white/60">
        <p>No heats scheduled on this floor yet.</p>
        {!hideBackLink && (
          <Link href="/commentator" className="text-sm text-repone-red underline">
            ← Choose a different floor
          </Link>
        )}
      </div>
    );
  }

  const lanes = heat.lanes.filter((l) => l.athleteId).sort((a, b) => a.laneNumber - b.laneNumber);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6">
      {!hideBackLink && (
        <p className="text-sm">
          <Link href="/commentator" className="text-repone-red underline">
            ← Choose a different floor
          </Link>
        </p>
      )}

      {/* Header — big enough to read at arm's length on a tablet */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-repone-gray px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-white/50">{eventName}</p>
          <p className="font-[family-name:var(--font-display)] text-3xl font-bold uppercase tracking-wide">
            {heat.wod.name} · Heat {heat.heatNumber}
            {heat.heatCount ? ` / ${heat.heatCount}` : ""}
          </p>
          <p className="text-base font-semibold uppercase tracking-wide text-repone-red">{heat.division.name}</p>
        </div>
        <span
          className={`h-3 w-3 rounded-full ${connected ? "bg-green-500" : "bg-repone-red animate-pulse"}`}
          title={connected ? "Live" : "Reconnecting…"}
        />
      </div>

      {/* Heat picker / follow controls — same pattern as Score Keeper */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-repone-gray px-5 py-4">
        <label className="flex flex-1 flex-col gap-1 text-xs uppercase tracking-wide text-white/50">
          Heat
          <select
            value={heat.id}
            onChange={(e) => goToHeat(e.target.value)}
            className="rounded-md border border-white/20 bg-black/40 px-3 py-3 text-lg text-white"
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
            ← Previous
          </button>
          <button
            type="button"
            className="control-btn w-fit px-4 py-3 text-xs disabled:opacity-30"
            disabled={heatIndex === -1 || heatIndex >= heats.length - 1}
            onClick={() => heatIndex >= 0 && heatIndex < heats.length - 1 && goToHeat(heats[heatIndex + 1].id)}
          >
            Next →
          </button>
        </div>
        {following ? (
          <span className="text-xs font-semibold uppercase tracking-wide text-repone-red">Following live heat</span>
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

      {/* One card per lane — everything a commentator needs on this athlete
          without switching screens. */}
      <div className="flex flex-col gap-4">
        {lanes.map((lane) => {
          const details = detailsByAthleteId[lane.athleteId!];
          const hasStats = details && (details.lifts.length > 0 || details.benchmarks.length > 0 || details.history.length > 0);
          return (
            <div key={lane.laneNumber} className="rounded-xl bg-repone-gray p-5">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <p className="flex items-center gap-3 text-2xl font-bold text-white">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded bg-repone-red text-base font-bold">
                    {lane.laneNumber}
                  </span>
                  {lane.name}
                </p>
                <div className="flex items-center gap-2 text-sm text-white/60">
                  {lane.affiliate && <span>{lane.affiliate}</span>}
                  {details?.ageCategoryLabel && (
                    <span className="rounded-full bg-black/40 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-repone-red">
                      {details.ageCategoryLabel}
                    </span>
                  )}
                </div>
              </div>

              {!hasStats ? (
                <p className="text-sm text-white/40">No lifts, benchmarks, or competition history on file yet.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {(details!.lifts.length > 0 || details!.benchmarks.length > 0) && (
                    <div>
                      <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-white/40">Lifts &amp; Benchmarks</p>
                      <div className="flex flex-wrap gap-2">
                        {details!.lifts.map((l) => (
                          <span key={l.id} className="rounded-full bg-black/40 px-3 py-1 text-sm text-white">
                            {l.label}: <span className="font-semibold">{l.valueDisplay}</span>
                          </span>
                        ))}
                        {details!.benchmarks.map((b) => (
                          <span key={b.id} className="rounded-full bg-black/40 px-3 py-1 text-sm text-white">
                            {b.name}: <span className="font-semibold">{b.resultDisplay}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {details!.history.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-white/40">Previous Standings</p>
                      <div className="flex flex-col gap-1.5">
                        {details!.history.map((h) => (
                          <div key={h.eventId} className="text-sm text-white">
                            <span className="font-semibold">{h.eventName}</span>
                            <span className="text-white/50"> ({h.divisionName})</span>
                            {h.overall?.placement && (
                              <span className="ml-2 font-semibold text-repone-red">#{h.overall.placement} overall</span>
                            )}
                            {h.wods.length > 0 && (
                              <div className="mt-0.5 flex flex-wrap gap-1.5">
                                {h.wods.map((w) => (
                                  <span key={w.wodId} className="rounded-full bg-black/40 px-2 py-0.5 text-xs text-white/70">
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
            </div>
          );
        })}
        {lanes.length === 0 && <p className="text-sm text-white/50">No athletes assigned to lanes for this heat yet.</p>}
      </div>
    </div>
  );
}

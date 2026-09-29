"use client";

import { useFloorOverlay } from "@/lib/realtime/useFloorOverlay";
import { useLiveTimer } from "@/lib/realtime/useLiveTimer";
import { useStandings } from "@/lib/realtime/useStandings";
import { TimerDisplay } from "@/components/graphics/TimerDisplay";
import type { EventLiveFloor } from "@/lib/db/queries";

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
      <section className="flex flex-col gap-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-white/50">Now Competing</h2>
        {floors.map((floor) => (
          <FloorNowCompeting key={floor.floorId} floor={floor} />
        ))}
        {floors.length === 0 && (
          <p className="text-white/50">No floors set up for this event yet.</p>
        )}
      </section>

      <section className="flex flex-col gap-8">
        <h2 className="text-xs font-bold uppercase tracking-widest text-white/50">Leaderboard</h2>
        {divisions.map((division) => (
          <DivisionLeaderboard key={division.id} division={division} />
        ))}
        {divisions.length === 0 && (
          <p className="text-white/50">No divisions set up for this event yet.</p>
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
    <div className="rounded-xl bg-repone-gray p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-white/50">
          {floor.venueName} — {floor.floorName}
        </p>
        <span
          className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-green-500" : "bg-repone-red animate-pulse"}`}
          title={connected ? "Live" : "Reconnecting…"}
        />
      </div>

      {!currentHeat ? (
        <p className="text-white/50">Competition hasn&apos;t started on this floor yet.</p>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-[family-name:var(--font-display)] text-xl font-bold uppercase tracking-wide">
              {currentHeat.wod.name} · Heat {currentHeat.heatNumber}
              {currentHeat.heatCount ? ` / ${currentHeat.heatCount}` : ""}
            </p>
            <p className="text-sm font-semibold uppercase tracking-wide text-repone-red">
              {currentHeat.division.name}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-1 sm:grid-cols-3">
              {currentHeat.lanes
                .filter((l) => l.name)
                .map((l) => (
                  <span key={l.laneNumber} className="text-sm text-white/70">
                    <span className="text-white/40">{l.laneNumber}.</span> {l.name}
                  </span>
                ))}
            </div>
          </div>
          {state && state.timer_status !== "idle" && (
            <TimerDisplay seconds={timer.displaySeconds} atLimit={timer.atLimit} />
          )}
        </div>
      )}
    </div>
  );
}

function DivisionLeaderboard({ division }: { division: { id: string; name: string } }) {
  const rows = useStandings(division.id);

  return (
    <div>
      <h3 className="mb-2 font-semibold uppercase tracking-wide text-repone-red">
        {division.name}
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-white/40">
          No scored results yet — standings fill in as heats are finished.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-white/40">
                <th className="py-2 pr-4">Place</th>
                <th className="py-2 pr-4">Athlete</th>
                <th className="py-2 pr-4">Points</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-white/5">
                  <td className="py-2 pr-4 font-bold text-repone-red">{r.placement ?? "—"}</td>
                  <td className="py-2 pr-4">{r.name}</td>
                  <td className="py-2 pr-4 font-semibold">{r.points ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

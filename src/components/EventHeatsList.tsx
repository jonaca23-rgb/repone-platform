import type { EventLiveFloor } from "@/lib/db/queries";

// Shared "full heat schedule, grouped by floor, live heat highlighted"
// reference view — used by both the Commentator and Producer event trees
// (commentator/events/[eventId]/heats, producer/events/[eventId]/heats).
// Pure/server-safe: no client state, no realtime subscription — this is a
// glance-ahead reference, not the live-following screen (that's each role's
// Dashboard tab).
export function EventHeatsList({ floors }: { floors: EventLiveFloor[] }) {
  return (
    <div className="flex flex-col gap-8">
      {floors.map((floor) => {
        const liveHeatId = floor.initialBroadcastState?.current_heat_id ?? null;
        return (
          <section key={floor.floorId} className="flex flex-col gap-2">
            <h2 className="text-xs font-bold uppercase tracking-widest text-white/50">
              {floor.venueName} — {floor.floorName}
            </h2>
            <div className="flex flex-col gap-1.5">
              {floor.heats.map((h) => (
                <div
                  key={h.id}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-4 py-2.5 ${
                    h.id === liveHeatId ? "bg-repone-red/20 ring-1 ring-repone-red" : "bg-repone-gray"
                  }`}
                >
                  <div>
                    <span className="font-semibold text-white">
                      {h.wod.name} · Heat {h.heatNumber}
                      {h.heatCount ? ` / ${h.heatCount}` : ""}
                    </span>
                    <span className="ml-2 text-sm text-white/60">{h.division.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide">
                    {h.id === liveHeatId && <span className="font-bold text-repone-red">● Live</span>}
                    {h.endedAt && <span className="text-white/40">Finished</span>}
                  </div>
                </div>
              ))}
              {floor.heats.length === 0 && <p className="text-sm text-white/40">No heats scheduled on this floor yet.</p>}
            </div>
          </section>
        );
      })}
      {floors.length === 0 && <p className="text-white/50">No floors set up for this event yet.</p>}
    </div>
  );
}

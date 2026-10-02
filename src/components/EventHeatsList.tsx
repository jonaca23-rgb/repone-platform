import type { EventLiveFloor } from "@/lib/db/queries";
import { Badge } from "@/components/ui/badge";

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
            <h2 className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
              {floor.venueName} — {floor.floorName}
            </h2>
            <ul className="flex flex-col gap-1.5">
              {floor.heats.map((h) => (
                <li
                  key={h.id}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-2.5 ${
                    h.id === liveHeatId ? "border-primary bg-primary/10" : "border-border bg-card"
                  }`}
                >
                  <div>
                    <span className="font-semibold">
                      {h.wod.name} · Heat {h.heatNumber}
                      {h.heatCount ? ` / ${h.heatCount}` : ""}
                    </span>
                    <span className="ml-2 text-sm text-muted-foreground">{h.division.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {h.id === liveHeatId && <Badge>Live</Badge>}
                    {h.endedAt && <Badge variant="secondary">Finished</Badge>}
                  </div>
                </li>
              ))}
            </ul>
            {floor.heats.length === 0 && (
              <p className="text-sm text-muted-foreground">No heats scheduled on this floor yet.</p>
            )}
          </section>
        );
      })}
      {floors.length === 0 && (
        <p className="text-muted-foreground">No floors set up for this event yet.</p>
      )}
    </div>
  );
}

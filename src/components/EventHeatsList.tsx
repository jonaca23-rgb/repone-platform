import type { EventLiveFloor } from "@/lib/db/queries";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Shared "full heat schedule, grouped by floor, live heat highlighted"
// reference view — used by both the Commentator and Producer event trees
// (commentator/events/[eventId]/heats, producer/events/[eventId]/heats).
// Pure/server-safe: no client state, no realtime subscription — this is a
// glance-ahead reference, not the live-following screen (that's each role's
// Dashboard tab).
export function EventHeatsList({ floors }: { floors: EventLiveFloor[] }) {
  if (floors.length === 0) {
    return <p className="text-muted-foreground">No floors set up for this event yet.</p>;
  }
  return (
    <div className="flex flex-col gap-8">
      {floors.map((floor) => {
        const liveHeatId = floor.initialBroadcastState?.current_heat_id ?? null;
        const headingId = `floor-${floor.floorId}`;
        return (
          <section key={floor.floorId} aria-labelledby={headingId} className="flex flex-col gap-2">
            <h2
              id={headingId}
              className="text-xs font-bold tracking-widest text-muted-foreground uppercase"
            >
              {floor.venueName} — {floor.floorName}
            </h2>
            {floor.heats.length > 0 ? (
              <div className="rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Heat</TableHead>
                      <TableHead>Division</TableHead>
                      <TableHead className="w-28">State</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {floor.heats.map((h) => {
                      const live = h.id === liveHeatId;
                      return (
                        <TableRow key={h.id} data-state={live ? "selected" : undefined}>
                          <TableCell className="font-semibold whitespace-normal">
                            {h.wod.name} · Heat {h.heatNumber}
                            {h.heatCount ? ` / ${h.heatCount}` : ""}
                          </TableCell>
                          <TableCell className="whitespace-normal">{h.division.name}</TableCell>
                          <TableCell>
                            {live ? (
                              <Badge>Live</Badge>
                            ) : h.endedAt ? (
                              <Badge variant="secondary">Finished</Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No heats scheduled on this floor yet.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

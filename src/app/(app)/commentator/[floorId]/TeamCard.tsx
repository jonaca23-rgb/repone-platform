import type { FloorLane } from "@/lib/db/floorLanes";
import { Card, CardContent } from "@/components/ui/card";

const SECTION = "text-xs font-bold tracking-widest text-muted-foreground uppercase";

/** One team in the current heat: lane, name, affiliate and who is on it. */
export function TeamCard({ lane }: { lane: FloorLane }) {
  return (
    <Card size="sm" className="h-full">
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded bg-primary font-display text-lg font-bold text-primary-foreground">
            {lane.laneNumber}
          </span>
          <div className="min-w-0">
            <h2 className="text-xl leading-tight font-bold">{lane.name}</h2>
            {lane.affiliate ? (
              <p className="text-sm text-muted-foreground">{lane.affiliate}</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <p className={SECTION}>Team</p>
          {lane.members.length > 0 ? (
            <ul className="flex flex-col gap-0.5">
              {lane.members.map((m) => (
                <li key={m} className="font-semibold">
                  {m}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No one on this team yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

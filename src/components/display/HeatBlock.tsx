import type { FloorHeat } from "@/lib/db/queries";
import { DisplayFrame } from "./DisplayFrame";

/**
 * A heat on the venue display: the WOD, which heat of how many, the division,
 * then one row per lane. Past ten lanes the affiliates drop so every lane
 * still fits the portrait screen.
 */
function HeatBlock({
  title,
  tone,
  heat,
  eventName,
}: {
  title: string;
  tone: "live" | "plain";
  heat: FloorHeat;
  eventName: string;
}) {
  const roomy = heat.lanes.length <= 10;
  const heatOf = heat.heatCount
    ? `Heat ${heat.heatNumber} of ${heat.heatCount}`
    : `Heat ${heat.heatNumber}`;
  return (
    <DisplayFrame title={title} tone={tone} eventName={eventName}>
      <p className="line-clamp-2 font-display text-dp-hero leading-[0.92] font-bold tracking-tight uppercase">
        {heat.wod.name}
      </p>
      <p className="mt-[24px] font-display text-dp-label font-bold tracking-wide text-broadcast-dim uppercase">
        {heatOf} · {heat.division.name}
      </p>
      <ol className="mt-[56px] flex min-h-0 flex-1 flex-col">
        {heat.lanes.map((lane) => (
          <li
            key={lane.laneNumber}
            className="flex min-h-0 flex-1 items-center gap-[36px] border-b-2 border-broadcast-muted last:border-none"
          >
            <span className="flex size-[88px] shrink-0 items-center justify-center bg-broadcast-accent font-display text-dp-body font-bold tabular-nums">
              {lane.laneNumber}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-dp-body leading-tight font-bold tracking-wide uppercase">
                {lane.name ?? "Open lane"}
              </span>
              {roomy && lane.affiliate ? (
                <span className="block truncate text-dp-label leading-tight text-broadcast-dim">
                  {lane.affiliate}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </DisplayFrame>
  );
}

export function CurrentHeatBlock({ heat, eventName }: { heat: FloorHeat; eventName: string }) {
  return <HeatBlock title="Now on the floor" tone="live" heat={heat} eventName={eventName} />;
}

export function NextHeatBlock({ heat, eventName }: { heat: FloorHeat; eventName: string }) {
  return <HeatBlock title="Up next" tone="plain" heat={heat} eventName={eventName} />;
}

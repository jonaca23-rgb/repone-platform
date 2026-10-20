import type { DivisionStandingRow } from "@/lib/scoring/pivotStandings";
import { DisplayFrame } from "./DisplayFrame";

/** The division's overall standings, top eight: place, name, points. */
export function LeaderboardBlock({
  division,
  rows,
  eventName,
}: {
  division: string;
  rows: DivisionStandingRow[];
  eventName: string;
}) {
  return (
    <DisplayFrame title="Leaderboard" tone="plain" eventName={eventName}>
      <p className="line-clamp-2 font-display text-dp-hero leading-[0.92] font-bold tracking-tight uppercase">
        {division}
      </p>
      <ol className="mt-[56px] flex min-h-0 flex-1 flex-col">
        {rows.slice(0, 8).map((r) => (
          <li
            key={r.key}
            className="flex min-h-0 flex-1 items-center gap-[36px] border-b-2 border-broadcast-muted last:border-none"
          >
            <span
              className={`flex size-[96px] shrink-0 items-center justify-center font-display text-dp-body font-bold tabular-nums ${
                r.placement === 1 ? "bg-broadcast-accent" : "bg-broadcast-muted"
              }`}
            >
              {r.placement ?? "–"}
            </span>
            <span className="min-w-0 flex-1 truncate font-display text-dp-body font-bold tracking-wide uppercase">
              {r.name}
            </span>
            <span className="shrink-0 font-display text-dp-body font-bold tabular-nums">
              {r.points ?? "–"}
              <span className="ml-[12px] text-dp-label text-broadcast-dim">pts</span>
            </span>
          </li>
        ))}
      </ol>
    </DisplayFrame>
  );
}

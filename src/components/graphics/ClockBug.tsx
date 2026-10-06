import { formatClock } from "@/lib/timer/compute";

/** The running clock as a corner bug over live video: compact, tabular, accent at the limit. */
export function ClockBug({ seconds, atLimit }: { seconds: number; atLimit: boolean }) {
  return (
    <div className="bg-broadcast-bg px-[28px] py-[10px] shadow-2xl">
      <span
        className={`font-display text-bc-clock leading-none font-bold tabular-nums ${
          atLimit ? "text-broadcast-accent" : "text-broadcast-fg"
        }`}
      >
        {formatClock(seconds)}
      </span>
    </div>
  );
}

import { formatClock } from "@/lib/timer/compute";

export function TimerDisplay({
  seconds,
  atLimit,
  fullScreen = false,
}: {
  seconds: number;
  atLimit: boolean;
  fullScreen?: boolean;
}) {
  return (
    <div
      className={
        fullScreen
          ? "flex h-screen w-screen items-center justify-center bg-broadcast-bg"
          : "inline-flex items-center justify-center bg-broadcast-bg px-10 py-6 shadow-2xl"
      }
    >
      <span
        className={`font-display font-bold tabular-nums tracking-tight ${
          fullScreen ? "text-[14rem]" : "text-7xl"
        } ${atLimit ? "text-broadcast-accent" : "text-broadcast-fg"}`}
      >
        {formatClock(seconds)}
      </span>
    </div>
  );
}

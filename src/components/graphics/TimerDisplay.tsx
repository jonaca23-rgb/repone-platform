import { formatClock } from "@/lib/timer/compute";

export function TimerDisplay({
  seconds,
  atLimit,
  fullScreen = false,
  size = "default",
}: {
  seconds: number;
  atLimit: boolean;
  fullScreen?: boolean;
  /** "board" is the smaller clock on the producer's control board. */
  size?: "default" | "board";
}) {
  return (
    <div
      className={
        fullScreen
          ? "flex h-screen w-screen items-center justify-center bg-broadcast-bg"
          : `inline-flex items-center justify-center bg-broadcast-bg shadow-2xl ${size === "board" ? "px-6 py-3" : "px-10 py-6"}`
      }
    >
      <span
        className={`font-display font-bold tabular-nums tracking-tight ${
          fullScreen ? "text-[14rem]" : size === "board" ? "text-5xl" : "text-7xl"
        } ${atLimit ? "text-broadcast-accent" : "text-broadcast-fg"}`}
      >
        {formatClock(seconds)}
      </span>
    </div>
  );
}

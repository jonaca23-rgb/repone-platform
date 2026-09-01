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
          ? "flex h-screen w-screen items-center justify-center bg-repone-black"
          : "inline-flex items-center justify-center bg-repone-black px-10 py-6 shadow-2xl"
      }
    >
      <span
        className={`font-[family-name:var(--font-display)] font-bold tabular-nums tracking-tight ${
          fullScreen ? "text-[14rem]" : "text-7xl"
        } ${atLimit ? "text-repone-red" : "text-repone-white"}`}
      >
        {formatClock(seconds)}
      </span>
    </div>
  );
}

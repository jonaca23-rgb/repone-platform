export interface LeaderboardRow {
  placement: number | null;
  name: string;
  value: string; // formatted score/points/time for display
}

export function Leaderboard({
  title,
  rows,
  fullScreen = false,
}: {
  title: string;
  rows: LeaderboardRow[];
  fullScreen?: boolean;
}) {
  const container = fullScreen
    ? "flex h-screen w-screen flex-col justify-center gap-3 bg-broadcast-bg px-24 py-16"
    : "flex w-[520px] flex-col gap-2 bg-broadcast-bg/95 px-6 py-5 shadow-2xl";

  return (
    <div className={container}>
      <div className="mb-2 flex items-center gap-3">
        <span className="h-8 w-1.5 bg-broadcast-accent" />
        <p className="font-display text-2xl font-bold uppercase tracking-widest text-broadcast-fg">
          {title}
        </p>
      </div>
      {rows.map((row, i) => (
        <div
          key={i}
          className="flex items-center justify-between border-b border-broadcast-fg/10 py-2 text-broadcast-fg last:border-none"
        >
          <div className="flex items-center gap-4">
            <span className="w-8 font-display text-xl font-bold text-broadcast-accent">
              {row.placement ?? "—"}
            </span>
            <span className="text-xl font-semibold uppercase tracking-wide">{row.name}</span>
          </div>
          <span className="font-display text-xl font-bold">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

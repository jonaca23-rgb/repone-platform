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
    ? "flex h-screen w-screen flex-col justify-center gap-3 bg-repone-black px-24 py-16"
    : "flex w-[520px] flex-col gap-2 bg-repone-black/95 px-6 py-5 shadow-2xl";

  return (
    <div className={container}>
      <div className="mb-2 flex items-center gap-3">
        <span className="h-8 w-1.5 bg-repone-red" />
        <p className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-widest text-repone-white">
          {title}
        </p>
      </div>
      {rows.map((row, i) => (
        <div
          key={i}
          className="flex items-center justify-between border-b border-white/10 py-2 text-repone-white last:border-none"
        >
          <div className="flex items-center gap-4">
            <span className="w-8 font-[family-name:var(--font-display)] text-xl font-bold text-repone-red">
              {row.placement ?? "—"}
            </span>
            <span className="text-xl font-semibold uppercase tracking-wide">{row.name}</span>
          </div>
          <span className="font-[family-name:var(--font-display)] text-xl font-bold">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

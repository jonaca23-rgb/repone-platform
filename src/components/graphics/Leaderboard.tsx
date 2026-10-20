export interface LeaderboardRow {
  placement: number | null;
  name: string;
  value: string; // formatted score/points/time for display
}

/** Rows that fit a full-frame card above the lower third's zone; the rest is for the live page. */
export const LEADERBOARD_FULL_ROWS = 8;
/** Rows on the compact board of a single-graphic source: the top ten fit the safe height. */
export const LEADERBOARD_COMPACT_ROWS = 10;

// The standings card. Full-frame fills the stage and shows the top eight (what
// fits above the lower third's zone); compact sits at the side of a
// single-graphic browser source. Sizes are stage pixels.
export function Leaderboard({
  title,
  rows,
  fullScreen = false,
}: {
  title: string;
  rows: LeaderboardRow[];
  fullScreen?: boolean;
}) {
  const shown = rows.slice(0, fullScreen ? LEADERBOARD_FULL_ROWS : LEADERBOARD_COMPACT_ROWS);
  const container = fullScreen
    ? "absolute inset-0 flex flex-col justify-center gap-[8px] bg-broadcast-bg px-[160px] pt-[54px] pb-[216px]"
    : "flex w-[640px] flex-col gap-[6px] bg-broadcast-bg/95 px-[32px] py-[28px] shadow-2xl";
  const rowText = fullScreen ? "text-bc-body" : "text-bc-label";

  return (
    <div className={container}>
      <div className="mb-[12px] flex items-center gap-[20px]">
        <span className={`w-[10px] bg-broadcast-accent ${fullScreen ? "h-[56px]" : "h-[36px]"}`} />
        <p
          className={`font-display leading-none font-bold tracking-widest text-broadcast-fg uppercase ${
            fullScreen ? "text-bc-title" : "text-bc-body"
          }`}
        >
          {title}
        </p>
      </div>
      {shown.map((row, i) => (
        <div
          key={i}
          className={`flex items-center justify-between border-b border-broadcast-fg/10 text-broadcast-fg last:border-none ${
            fullScreen ? "py-[8px]" : "py-[6px]"
          }`}
        >
          <div className="flex min-w-0 items-center gap-[24px]">
            <span
              className={`w-[64px] font-display font-bold text-broadcast-accent tabular-nums ${rowText}`}
            >
              {row.placement ?? "—"}
            </span>
            <span className={`font-semibold tracking-wide uppercase ${rowText}`}>{row.name}</span>
          </div>
          <span className={`font-display font-bold tabular-nums ${rowText}`}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

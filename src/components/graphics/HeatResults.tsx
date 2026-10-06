export interface HeatResultRow {
  laneNumber: number;
  name: string;
  /** Formatted result (lib/scoring/formatResult), "—" until scored. */
  value: string;
  /** Place in the WOD for the division, null until standings are computed. */
  placement: number | null;
}

/** The "Score" graphic: the current heat's results, best place first, unscored lanes last. */
export function HeatResults({ title, rows }: { title: string; rows: HeatResultRow[] }) {
  const ordered = [...rows].sort(
    (a, b) =>
      (a.placement ?? Number.POSITIVE_INFINITY) - (b.placement ?? Number.POSITIVE_INFINITY) ||
      a.laneNumber - b.laneNumber,
  );

  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-[12px] bg-broadcast-bg px-[160px] pt-[54px] pb-[216px] text-broadcast-fg">
      <div className="mb-[16px] flex items-center gap-[20px]">
        <span className="h-[56px] w-[10px] bg-broadcast-accent" />
        <p className="font-display text-bc-title leading-none font-bold tracking-widest uppercase">
          {title}
        </p>
      </div>
      {ordered.map((row) => (
        <div
          key={row.laneNumber}
          className="flex items-center justify-between border-b border-broadcast-fg/10 py-[12px] last:border-none"
        >
          <div className="flex min-w-0 items-center gap-[24px]">
            <span className="flex size-[64px] shrink-0 items-center justify-center bg-broadcast-accent text-bc-label font-bold">
              {row.laneNumber}
            </span>
            <span className="text-bc-body font-semibold tracking-wide uppercase">{row.name}</span>
          </div>
          <div className="flex items-center gap-[40px]">
            <span className="font-display text-bc-body font-bold tabular-nums">{row.value}</span>
            <span className="w-[96px] text-right font-display text-bc-body font-bold text-broadcast-fg/70">
              {row.placement != null ? `#${row.placement}` : ""}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

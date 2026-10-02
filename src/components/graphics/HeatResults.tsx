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
    <div className="flex h-screen w-screen flex-col justify-center gap-3 bg-broadcast-bg px-24 py-16">
      <div className="mb-2 flex items-center gap-3">
        <span className="h-8 w-1.5 bg-broadcast-accent" />
        <p className="font-display text-2xl font-bold uppercase tracking-widest text-broadcast-fg">
          {title}
        </p>
      </div>
      {ordered.map((row) => (
        <div
          key={row.laneNumber}
          className="flex items-center justify-between border-b border-broadcast-fg/10 py-2 text-broadcast-fg last:border-none"
        >
          <div className="flex items-center gap-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-broadcast-accent font-bold">
              {row.laneNumber}
            </span>
            <span className="text-xl font-semibold uppercase tracking-wide">{row.name}</span>
          </div>
          <div className="flex items-center gap-6">
            <span className="font-display text-xl font-bold tabular-nums">{row.value}</span>
            <span className="w-14 text-right font-display text-xl font-bold text-broadcast-fg/70">
              {row.placement != null ? `#${row.placement}` : ""}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

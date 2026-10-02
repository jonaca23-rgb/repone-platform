// "HEAT IDENTIFICATION" package — WOD / heat-of-total / division.
// Designed to sit top-left as a persistent ID strip, or full-screen as a heat intro.
export function HeatIdentification({
  wodName,
  heatNumber,
  heatCount,
  divisionName,
  fullScreen = false,
}: {
  wodName: string;
  heatNumber: number;
  heatCount: number | null;
  divisionName: string;
  fullScreen?: boolean;
}) {
  if (fullScreen) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-broadcast-bg text-broadcast-fg">
        <div className="mb-4 h-1.5 w-40 bg-broadcast-accent" />
        <p className="font-display text-5xl font-bold uppercase tracking-widest">{wodName}</p>
        <p className="mt-4 text-3xl font-semibold uppercase tracking-wide text-broadcast-fg/80">
          Heat {heatNumber}
          {heatCount ? ` of ${heatCount}` : ""}
        </p>
        <p className="mt-2 text-2xl font-medium uppercase tracking-wide text-broadcast-accent">
          {divisionName}
        </p>
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col bg-broadcast-bg px-6 py-3 text-broadcast-fg shadow-lg">
      <div className="flex items-center gap-3">
        <span className="h-full w-1 self-stretch bg-broadcast-accent" />
        <div>
          <p className="font-display text-2xl font-bold uppercase tracking-wide leading-tight">
            {wodName} — Heat {heatNumber}
            {heatCount ? ` / ${heatCount}` : ""}
          </p>
          <p className="text-sm font-semibold uppercase tracking-widest text-broadcast-accent">
            {divisionName}
          </p>
        </div>
      </div>
    </div>
  );
}

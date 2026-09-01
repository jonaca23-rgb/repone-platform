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
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-repone-black text-repone-white">
        <div className="mb-4 h-1.5 w-40 bg-repone-red" />
        <p className="font-[family-name:var(--font-display)] text-5xl font-bold uppercase tracking-widest">
          {wodName}
        </p>
        <p className="mt-4 text-3xl font-semibold uppercase tracking-wide text-white/80">
          Heat {heatNumber}
          {heatCount ? ` of ${heatCount}` : ""}
        </p>
        <p className="mt-2 text-2xl font-medium uppercase tracking-wide text-repone-red">{divisionName}</p>
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col bg-repone-black px-6 py-3 text-repone-white shadow-lg">
      <div className="flex items-center gap-3">
        <span className="h-full w-1 self-stretch bg-repone-red" />
        <div>
          <p className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-wide leading-tight">
            {wodName} — Heat {heatNumber}
            {heatCount ? ` / ${heatCount}` : ""}
          </p>
          <p className="text-sm font-semibold uppercase tracking-widest text-repone-red">{divisionName}</p>
        </div>
      </div>
    </div>
  );
}

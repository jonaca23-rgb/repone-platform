export interface LaneEntry {
  laneNumber: number;
  name: string | null;
  affiliate: string | null;
}

// "LANE IDENTIFICATION" package — full lane board for a heat intro/lanes graphic.
export function LanesBoard({
  lanes,
  fullScreen = false,
}: {
  lanes: LaneEntry[];
  fullScreen?: boolean;
}) {
  if (fullScreen) {
    return (
      <div className="flex h-screen w-screen flex-col justify-center gap-2 bg-repone-black px-24 py-16 text-repone-white">
        {lanes.map((lane) => (
          <div
            key={lane.laneNumber}
            className="flex items-center gap-6 border-b border-white/10 py-3"
          >
            <span className="flex h-14 w-14 shrink-0 items-center justify-center bg-repone-red font-[family-name:var(--font-display)] text-2xl font-bold">
              {lane.laneNumber}
            </span>
            <div>
              <p className="font-[family-name:var(--font-display)] text-3xl font-bold uppercase tracking-wide">
                {lane.name ?? "TBD"}
              </p>
              {lane.affiliate ? (
                <p className="text-lg uppercase tracking-wide text-white/60">{lane.affiliate}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col gap-1 bg-repone-black/95 px-5 py-4 text-repone-white shadow-lg">
      {lanes.map((lane) => (
        <div key={lane.laneNumber} className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-repone-red text-sm font-bold">
            {lane.laneNumber}
          </span>
          <span className="font-semibold uppercase tracking-wide">{lane.name ?? "TBD"}</span>
        </div>
      ))}
    </div>
  );
}

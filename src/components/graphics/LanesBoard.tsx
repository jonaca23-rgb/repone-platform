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
      <div className="flex h-screen w-screen flex-col justify-center gap-2 bg-broadcast-bg px-24 py-16 text-broadcast-fg">
        {lanes.map((lane) => (
          <div
            key={lane.laneNumber}
            className="flex items-center gap-6 border-b border-broadcast-fg/10 py-3"
          >
            <span className="flex h-14 w-14 shrink-0 items-center justify-center bg-broadcast-accent font-display text-2xl font-bold">
              {lane.laneNumber}
            </span>
            <div>
              <p className="font-display text-3xl font-bold uppercase tracking-wide">
                {lane.name ?? "TBD"}
              </p>
              {lane.affiliate ? (
                <p className="text-lg uppercase tracking-wide text-broadcast-fg/60">
                  {lane.affiliate}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col gap-1 bg-broadcast-bg/95 px-5 py-4 text-broadcast-fg shadow-lg">
      {lanes.map((lane) => (
        <div key={lane.laneNumber} className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-broadcast-accent text-sm font-bold">
            {lane.laneNumber}
          </span>
          <span className="font-semibold uppercase tracking-wide">{lane.name ?? "TBD"}</span>
        </div>
      ))}
    </div>
  );
}

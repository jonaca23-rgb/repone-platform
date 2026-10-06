export interface LaneEntry {
  laneNumber: number;
  name: string | null;
  affiliate: string | null;
}

// "LANE IDENTIFICATION" package. Full-frame: the heat's lane board as a card
// filling the stage, laid out inside the safe area. Compact: a lane list for a
// corner of a single-graphic browser source. Sizes are stage pixels.
export function LanesBoard({
  lanes,
  fullScreen = false,
}: {
  lanes: LaneEntry[];
  fullScreen?: boolean;
}) {
  if (fullScreen) {
    return (
      <div className="absolute inset-0 flex flex-col justify-center gap-[12px] bg-broadcast-bg px-[160px] py-[54px] text-broadcast-fg">
        {lanes.map((lane) => (
          <div
            key={lane.laneNumber}
            className="flex items-center gap-[32px] border-b border-broadcast-fg/10 py-[14px] last:border-none"
          >
            <span className="flex size-[72px] shrink-0 items-center justify-center bg-broadcast-accent font-display text-bc-body font-bold">
              {lane.laneNumber}
            </span>
            <div className="min-w-0">
              <p className="font-display text-bc-body leading-tight font-bold tracking-wide uppercase">
                {lane.name ?? "TBD"}
              </p>
              {lane.affiliate ? (
                <p className="text-bc-label tracking-wide text-broadcast-fg/70 uppercase">
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
    <div className="inline-flex flex-col gap-[8px] bg-broadcast-bg/95 px-[28px] py-[22px] text-broadcast-fg shadow-2xl">
      {lanes.map((lane) => (
        <div key={lane.laneNumber} className="flex items-center gap-[16px]">
          <span className="flex size-[48px] shrink-0 items-center justify-center bg-broadcast-accent text-bc-label font-bold">
            {lane.laneNumber}
          </span>
          <span className="text-bc-label font-semibold tracking-wide uppercase">
            {lane.name ?? "TBD"}
          </span>
        </div>
      ))}
    </div>
  );
}

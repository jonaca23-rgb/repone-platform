// "HEAT IDENTIFICATION" package — WOD / heat-of-total / division.
// The compact strip sits top-left in the safe area (with the clock bug, or on its
// own source); full-frame fills the stage as a heat intro. Sizes are stage pixels.
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
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-broadcast-bg px-[192px] pt-[54px] pb-[216px] text-center text-broadcast-fg">
        <div className="mb-[32px] h-[12px] w-[240px] bg-broadcast-accent" />
        <p className="font-display text-bc-hero leading-none font-bold tracking-widest uppercase">
          {wodName}
        </p>
        <p className="mt-[32px] text-bc-title font-semibold tracking-wide text-broadcast-fg/85 uppercase">
          Heat {heatNumber}
          {heatCount ? ` of ${heatCount}` : ""}
        </p>
        <p className="mt-[16px] text-bc-body font-medium tracking-wide text-broadcast-accent uppercase">
          {divisionName}
        </p>
      </div>
    );
  }

  return (
    <div className="inline-flex bg-broadcast-bg px-[28px] py-[16px] text-broadcast-fg shadow-2xl">
      <div className="flex items-stretch gap-[18px]">
        <span className="w-[8px] bg-broadcast-accent" />
        <div>
          <p className="font-display text-bc-body leading-tight font-bold tracking-wide uppercase">
            {wodName} · Heat {heatNumber}
            {heatCount ? ` / ${heatCount}` : ""}
          </p>
          <p className="text-bc-label font-semibold tracking-widest text-broadcast-accent uppercase">
            {divisionName}
          </p>
        </div>
      </div>
    </div>
  );
}

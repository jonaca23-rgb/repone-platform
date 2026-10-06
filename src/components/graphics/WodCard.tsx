// The workout card. Full-frame fills the stage; compact sits beside the action.
// Sizes are stage pixels.
export function WodCard({
  name,
  description,
  timeCapSeconds,
  fullScreen = false,
}: {
  name: string;
  description: string | null;
  timeCapSeconds: number | null;
  fullScreen?: boolean;
}) {
  // A long chipper steps down a size, and the clamp keeps any description on the stage.
  const long = (description?.length ?? 0) > 240;
  const timeCap = timeCapSeconds ? `${Math.floor(timeCapSeconds / 60)} MIN CAP` : null;

  return (
    <div
      className={
        fullScreen
          ? "absolute inset-0 flex flex-col items-center justify-center bg-broadcast-bg px-[192px] pt-[54px] pb-[216px] text-center text-broadcast-fg"
          : "flex w-[720px] flex-col bg-broadcast-bg/95 px-[40px] py-[32px] text-broadcast-fg shadow-2xl"
      }
    >
      <p
        className={`font-display font-bold tracking-widest text-broadcast-accent uppercase ${
          fullScreen ? "text-bc-hero leading-none" : "text-bc-title leading-tight"
        }`}
      >
        {name}
      </p>
      {description ? (
        <p
          className={`mt-[24px] leading-snug whitespace-pre-line ${
            long ? "text-bc-label" : "text-bc-body"
          } ${fullScreen ? "line-clamp-[12]" : "line-clamp-[9]"}`}
        >
          {description}
        </p>
      ) : null}
      {timeCap ? (
        <p className="mt-[24px] text-bc-label font-bold tracking-widest text-broadcast-fg/70 uppercase">
          {timeCap}
        </p>
      ) : null}
    </div>
  );
}

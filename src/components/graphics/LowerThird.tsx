// Classic broadcast lower third: athlete name / division / box-affiliate.
// Its parent places it (Program and the lower-third source put it at the safe
// area's bottom-left). Sizes are stage pixels.
export function LowerThird({
  name,
  division,
  affiliate,
}: {
  name: string;
  division?: string | null;
  affiliate?: string | null;
}) {
  return (
    <div className="flex items-stretch shadow-2xl">
      <div className="w-[12px] bg-broadcast-accent" />
      <div className="flex flex-col justify-center bg-broadcast-muted px-[40px] py-[20px]">
        <p className="font-display text-bc-title leading-none font-bold tracking-wide text-broadcast-fg uppercase">
          {name}
        </p>
        {(division || affiliate) && (
          <p className="mt-[10px] text-bc-label font-medium tracking-widest text-broadcast-fg/75 uppercase">
            {[division, affiliate].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}

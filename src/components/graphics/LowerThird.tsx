// Classic broadcast lower-third: athlete name / division / box-affiliate.
// Positioned absolutely so it sits over live video on a transparent overlay page.
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
    <div className="absolute bottom-[8%] left-[4%] flex items-stretch shadow-2xl">
      <div className="w-2 bg-broadcast-accent" />
      <div className="flex flex-col justify-center bg-broadcast-bg/95 px-8 py-4">
        <p className="font-display text-4xl font-bold uppercase tracking-wide text-broadcast-fg">
          {name}
        </p>
        {(division || affiliate) && (
          <p className="mt-1 text-lg font-medium uppercase tracking-widest text-broadcast-fg/70">
            {[division, affiliate].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}

// A sponsor's moment on air. Full-frame fills the stage in white; compact sits
// in a corner. Sizes are stage pixels.
export function SponsorCard({
  businessName,
  logoUrl,
  tierLabel,
  fullScreen = false,
}: {
  businessName: string;
  logoUrl: string | null;
  tierLabel?: string;
  fullScreen?: boolean;
}) {
  return (
    <div
      className={
        fullScreen
          ? "absolute inset-0 flex flex-col items-center justify-center gap-[40px] bg-broadcast-fg px-[192px] pt-[54px] pb-[216px]"
          : "flex w-[520px] flex-col items-center gap-[16px] bg-broadcast-fg px-[40px] py-[32px] shadow-2xl"
      }
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={businessName}
          className={`object-contain ${fullScreen ? "max-h-[480px] max-w-[1200px]" : "max-h-[200px] max-w-[440px]"}`}
        />
      ) : (
        <p
          className={`font-display font-bold tracking-wide text-broadcast-bg uppercase ${
            fullScreen ? "text-bc-hero" : "text-bc-title"
          }`}
        >
          {businessName}
        </p>
      )}
      {tierLabel ? (
        <p className="text-bc-label font-bold tracking-widest text-broadcast-accent uppercase">
          {tierLabel}
        </p>
      ) : null}
    </div>
  );
}

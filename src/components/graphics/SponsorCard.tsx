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
          ? "flex h-screen w-screen flex-col items-center justify-center gap-6 bg-repone-white"
          : "flex w-[420px] flex-col items-center gap-3 bg-repone-white px-8 py-6 shadow-2xl"
      }
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={businessName} className="max-h-40 max-w-[80%] object-contain" />
      ) : (
        <p className="font-[family-name:var(--font-display)] text-4xl font-bold uppercase tracking-wide text-repone-black">
          {businessName}
        </p>
      )}
      {tierLabel ? (
        <p className="text-sm font-bold uppercase tracking-widest text-repone-red">{tierLabel}</p>
      ) : null}
    </div>
  );
}

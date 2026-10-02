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
          ? "flex h-screen w-screen flex-col items-center justify-center gap-6 bg-broadcast-fg"
          : "flex w-[420px] flex-col items-center gap-3 bg-broadcast-fg px-8 py-6 shadow-2xl"
      }
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={businessName} className="max-h-40 max-w-[80%] object-contain" />
      ) : (
        <p className="font-display text-4xl font-bold uppercase tracking-wide text-broadcast-bg">
          {businessName}
        </p>
      )}
      {tierLabel ? (
        <p className="text-sm font-bold uppercase tracking-widest text-broadcast-accent">
          {tierLabel}
        </p>
      ) : null}
    </div>
  );
}

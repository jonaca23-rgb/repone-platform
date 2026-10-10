import type { EventSponsor } from "@/lib/db/sponsors";

/**
 * A sponsor's turn on the venue display: its newest creative, full-bleed
 * (designed at 2160x3840). A sponsor without one gets its logo, or its name,
 * on white with the package it bought.
 */
export function SponsorAdBlock({ sponsor }: { sponsor: EventSponsor }) {
  const creative = sponsor.creatives[0];
  if (creative) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={creative.url}
        alt={sponsor.businessName}
        className="absolute inset-0 h-full w-full bg-broadcast-bg object-cover"
      />
    );
  }
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-[72px] bg-broadcast-fg px-[96px] text-center text-broadcast-bg">
      {sponsor.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={sponsor.logoUrl}
          alt={sponsor.businessName}
          className="max-h-[720px] max-w-[880px] object-contain"
        />
      ) : (
        <p className="font-display text-dp-hero leading-[0.92] font-bold tracking-tight uppercase">
          {sponsor.businessName}
        </p>
      )}
      <p className="font-display text-dp-label font-bold tracking-widest text-broadcast-accent uppercase">
        {sponsor.packageName}
      </p>
    </div>
  );
}

import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getFloorContext } from "@/lib/db/queries";
import { type OverlaySource, OverlayLinks } from "./OverlayLinks";

// Program first: on a YoloBox (at most three web overlays on an Ultra) or any
// single browser source, Program is the one to add.
const SOURCES: OverlaySource[] = [
  {
    slug: "program",
    name: "Program",
    description:
      "Everything Production puts on air — cards, clock, lower third. Use this one in YoloBox.",
  },
  { slug: "timer", name: "Timer", description: "The running clock, top right." },
  { slug: "heat", name: "Heat", description: "The heat strip, top left." },
  { slug: "lanes", name: "Lanes", description: "The lanes in this heat." },
  { slug: "leaderboard", name: "Leaderboard", description: "The division's overall standings." },
  { slug: "lower-third", name: "Lower third", description: "The athlete name strip." },
  { slug: "wod", name: "WOD", description: "The workout card." },
  { slug: "sponsor", name: "Sponsor", description: "The sponsor card." },
];

// Not a broadcast graphic: the operator's reference for setting up YoloBox,
// OBS or vMix — every browser-source URL for this floor, ready to copy.
export default async function OverlayIndexPage({
  params,
}: {
  params: Promise<{ floorId: string }>;
}) {
  const { floorId } = await params;
  const context = await getFloorContext(floorId);
  if (!context) notFound();

  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const protocol =
    hdrs.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-broadcast-bg p-6 text-broadcast-fg sm:p-10">
      <h1 className="font-display text-2xl font-bold tracking-wide uppercase">
        Overlay URLs — {context.eventName}
      </h1>
      <p className="border-l-4 border-broadcast-accent bg-broadcast-fg/5 px-4 py-3 text-base">
        YoloBox or a single browser source: add Program. It shows whatever Production puts on air.
      </p>
      <OverlayLinks origin={origin} floorId={floorId} sources={SOURCES} />
      <Link
        href={`/overlay/${floorId}/test`}
        className="inline-flex min-h-11 w-fit items-center rounded border border-broadcast-fg/30 px-4 text-sm font-bold tracking-wide uppercase"
      >
        Check the picture on your device
      </Link>
    </main>
  );
}

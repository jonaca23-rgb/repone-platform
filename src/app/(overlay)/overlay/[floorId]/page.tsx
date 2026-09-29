import { notFound } from "next/navigation";
import { getFloorContext } from "@/lib/db/queries";

const ROUTES = [
  "program",
  "timer",
  "heat",
  "lanes",
  "lower-third",
  "leaderboard",
  "wod",
  "sponsor",
];

// Not itself a broadcast graphic — a plain reference page listing every
// browser-source URL for this floor, for whoever is setting up OBS/vMix/YoloBox.
export default async function OverlayIndexPage({
  params,
}: {
  params: Promise<{ floorId: string }>;
}) {
  const { floorId } = await params;
  const context = await getFloorContext(floorId);
  if (!context) notFound();

  return (
    <div className="flex min-h-screen flex-col gap-3 bg-repone-black p-10 text-repone-white">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-wide">
        Overlay URLs — {context.eventName}
      </h1>
      <p className="text-sm text-white/50">
        Add each URL as a Browser Source in OBS/vMix/YoloBox. Background is transparent.
      </p>
      <ul className="mt-4 flex flex-col gap-2 font-mono text-sm">
        {ROUTES.map((r) => (
          <li key={r} className="rounded bg-white/5 px-4 py-2">
            /overlay/{floorId}/{r}
          </li>
        ))}
      </ul>
    </div>
  );
}

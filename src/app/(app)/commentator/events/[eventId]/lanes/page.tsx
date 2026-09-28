import { notFound } from "next/navigation";
import { getEventLiveContext } from "@/lib/db/queries";

// Quick "who's in the lanes right now" reference per floor — the live heat
// if one is running, else the first scheduled heat. Full per-athlete
// stats/history live on the Dashboard tab; this tab is just lane numbers
// and names for a fast glance.
export default async function CommentatorEventLanesPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const context = await getEventLiveContext(eventId);
  if (!context) notFound();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6">
      {context.floors.map((floor) => {
        const liveHeatId = floor.initialBroadcastState?.current_heat_id ?? null;
        const heat = floor.heats.find((h) => h.id === liveHeatId) ?? floor.heats[0] ?? null;
        const lanes = (heat?.lanes ?? []).filter((l) => l.athleteId).sort((a, b) => a.laneNumber - b.laneNumber);

        return (
          <section key={floor.floorId} className="flex flex-col gap-2">
            <h2 className="text-xs font-bold uppercase tracking-widest text-white/50">
              {floor.venueName} — {floor.floorName}
            </h2>
            {!heat ? (
              <p className="text-sm text-white/40">No heats scheduled on this floor yet.</p>
            ) : (
              <>
                <p className="text-sm text-white/60">
                  {heat.wod.name} · Heat {heat.heatNumber} — {heat.division.name}
                  {heat.id === liveHeatId && <span className="ml-2 font-bold text-repone-red">● Live</span>}
                </p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {lanes.map((l) => (
                    <div key={l.laneNumber} className="flex items-center gap-3 rounded-lg bg-repone-gray px-4 py-3">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded bg-repone-red text-sm font-bold text-white">
                        {l.laneNumber}
                      </span>
                      <div>
                        <p className="font-semibold text-white">{l.name}</p>
                        {l.affiliate && <p className="text-xs text-white/50">{l.affiliate}</p>}
                      </div>
                    </div>
                  ))}
                  {lanes.length === 0 && <p className="text-sm text-white/50">No athletes assigned to lanes yet.</p>}
                </div>
              </>
            )}
          </section>
        );
      })}
      {context.floors.length === 0 && <p className="text-white/50">No floors set up for this event yet.</p>}
    </div>
  );
}

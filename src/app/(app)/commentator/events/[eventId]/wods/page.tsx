import { notFound } from "next/navigation";
import { getEventLiveContext } from "@/lib/db/queries";

export default async function CommentatorEventWodsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const context = await getEventLiveContext(eventId);
  if (!context) notFound();

  // Same WOD can appear on multiple floors' heats (or across divisions) —
  // dedupe by id so it's listed once.
  const wodById = new Map(context.floors.flatMap((f) => f.heats.map((h) => [h.wod.id, h.wod])));
  const wods = Array.from(wodById.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6">
      {wods.map((w) => (
        <div key={w.id} className="rounded-xl bg-repone-gray p-5">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xl font-bold text-white">{w.name}</p>
            <span className="rounded-full bg-black/40 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-repone-red">
              {w.scoring_type.replace("_", " ")}
              {w.time_cap_seconds ? ` · ${Math.round(w.time_cap_seconds / 60)} min cap` : ""}
            </span>
          </div>
          {w.description ? (
            <p className="whitespace-pre-wrap text-sm text-white/70">{w.description}</p>
          ) : (
            <p className="text-sm text-white/40">No description on file.</p>
          )}
        </div>
      ))}
      {wods.length === 0 && <p className="text-white/50">No WODs scheduled for this event yet.</p>}
    </div>
  );
}

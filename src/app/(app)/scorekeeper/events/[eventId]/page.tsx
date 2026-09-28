import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";
import { isAssignedToEvent } from "@/lib/auth/eventRoles";
import { createClient } from "@/lib/db/server";

/**
 * Event-scoped floor picker for Scorekeeper — the actual scoring screen
 * stays exactly where it already is (/scorekeeper/[floorId], unchanged and
 * untouched here, since that's the safety-critical, already-tested live
 * scoring UI). This page just adds the assignment gate + a floor list
 * scoped to one specific event, replacing the old flat "pick any org event,
 * then a floor" two-step picker at /scorekeeper.
 */
export default async function ScoreKeeperEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");

  const allowed = await isAssignedToEvent(ctx, eventId, "scorekeeper");
  if (!allowed) redirect("/scorekeeper");

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, name, venues(id, name, floors(id, name))")
    .eq("id", eventId)
    .single();
  if (!event) notFound();

  const floors = (event.venues ?? []).flatMap((v) => (v.floors ?? []).map((f) => ({ ...f, venueName: v.name })));

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <p className="mb-4 text-sm">
        <Link href="/scorekeeper" className="text-repone-red underline">
          ← Choose a different event
        </Link>
      </p>
      <h1 className="mb-1 font-[family-name:var(--font-display)] text-3xl font-bold uppercase tracking-wide">
        {event.name}
      </h1>
      <p className="mb-6 text-sm text-white/50">Select a Floor to Score</p>
      <div className="flex flex-col gap-4">
        {floors.map((f) => (
          <Link
            key={f.id}
            href={`/scorekeeper/${f.id}`}
            className="control-btn control-btn-red flex-col !items-start gap-1 py-6"
          >
            <span className="text-2xl">{f.name}</span>
            <span className="text-sm font-normal normal-case tracking-normal opacity-80">{f.venueName}</span>
          </Link>
        ))}
        {floors.length === 0 && (
          <p className="text-white/50">No floors set up for this event yet — set one up in Admin.</p>
        )}
      </div>
    </div>
  );
}

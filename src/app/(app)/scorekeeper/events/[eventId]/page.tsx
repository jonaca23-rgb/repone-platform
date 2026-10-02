import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, MapPinOff } from "lucide-react";
import { getSessionContext } from "@/lib/auth/session";
import { isAssignedToEvent } from "@/lib/auth/eventRoles";
import { createClient } from "@/lib/db/server";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { PickLink } from "@/components/app/PickLink";
import { OperatorShell } from "@/components/shells/OperatorShell";

type Props = { params: Promise<{ eventId: string }> };

// Read once per request: the page and its title share it.
const getEventWithFloors = cache(async (eventId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("id, name, venues(id, name, floors(id, name))")
    .eq("id", eventId)
    .maybeSingle();
  return data;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await getEventWithFloors((await params).eventId);
  return { title: event ? `Scorekeeper · ${event.name}` : "Scorekeeper" };
}

/**
 * Event-scoped floor picker for Scorekeeper — the actual scoring screen
 * stays exactly where it already is (/scorekeeper/[floorId]). This page just
 * adds the assignment gate + a floor list scoped to one specific event,
 * replacing the old flat "pick any org event, then a floor" two-step picker
 * at /scorekeeper.
 */
export default async function ScoreKeeperEventPage({ params }: Props) {
  const { eventId } = await params;
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");

  const allowed = await isAssignedToEvent(ctx, eventId, "scorekeeper");
  if (!allowed) redirect("/scorekeeper");

  const event = await getEventWithFloors(eventId);
  if (!event) notFound();

  const floors = (event.venues ?? []).flatMap((v) =>
    (v.floors ?? []).map((f) => ({ ...f, venueName: v.name })),
  );

  return (
    <OperatorShell module="scorekeeper" moduleLabel="Scorekeeper" eventName={event.name}>
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-10 sm:px-6">
        <Link
          href="/scorekeeper"
          className="inline-flex min-h-11 w-fit items-center gap-1 rounded-sm text-sm text-brand-text underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Choose a different event
        </Link>
        <PageHeader title="Select a floor to score" />
        {floors.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {floors.map((f) => (
              <li key={f.id}>
                <PickLink href={`/scorekeeper/${f.id}`} title={f.name} detail={f.venueName} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={MapPinOff}
            title="No floors set up for this event yet"
            description="Set one up in Admin."
          />
        )}
      </div>
    </OperatorShell>
  );
}

import { notFound, redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";
import { isAssignedToEvent } from "@/lib/auth/eventRoles";
import { EventTabs } from "@/components/shells/EventTabs";
import { OperatorShell } from "@/components/shells/OperatorShell";
import { getProducerEvent } from "./producerEvent";

const TABS = [
  { slug: "dashboard", label: "Overview" },
  { slug: "production", label: "Production" },
  { slug: "broadcast", label: "Broadcast" },
  { slug: "scores", label: "Scores" },
  { slug: "heats", label: "Heats" },
  { slug: "sponsors", label: "Sponsors" },
  { slug: "commentary", label: "Commentary" },
];

/**
 * Gate for the whole event-scoped Producer tree (/producer/events/[eventId]/*):
 * the outer producer/layout.tsx already confirmed this is a signed-in staff
 * account; this layer confirms they're actually allowed to see THIS event —
 * an admin always is, anyone else only if event_producer_assignments has an
 * active row for them (see lib/auth/eventRoles.ts /
 * 0024_event_role_assignments.sql).
 */
export default async function ProducerEventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");

  const allowed = await isAssignedToEvent(ctx, eventId, "producer");
  if (!allowed) redirect("/producer");

  const event = await getProducerEvent(eventId);
  if (!event) notFound();

  return (
    <OperatorShell
      module="producer"
      moduleLabel="Producer"
      eventName={event.name}
      tabs={
        <EventTabs
          ariaLabel="Event"
          items={TABS.map((t) => ({
            href: `/producer/events/${eventId}/${t.slug}`,
            label: t.label,
          }))}
        />
      }
    >
      {children}
    </OperatorShell>
  );
}

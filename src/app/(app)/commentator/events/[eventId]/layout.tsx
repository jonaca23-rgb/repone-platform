import { notFound, redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";
import { isAssignedToEvent } from "@/lib/auth/eventRoles";
import { EventTabs } from "@/components/shells/EventTabs";
import { OperatorShell } from "@/components/shells/OperatorShell";
import { getCommentatorEvent } from "./commentatorEvent";

// Notes (/notes) is a "not built yet" placeholder: the route stays, the tab
// comes back once commentator notes exist.
const TABS = [
  { slug: "dashboard", label: "Dashboard" },
  { slug: "lanes", label: "Lanes" },
  { slug: "athletes", label: "Athletes" },
  { slug: "heats", label: "Heats" },
  { slug: "wods", label: "WODs" },
  { slug: "leaderboard", label: "Leaderboard" },
];

/**
 * Gate for the whole event-scoped Commentator tree
 * (/commentator/events/[eventId]/*): the outer commentator/layout.tsx
 * already confirmed this is a signed-in staff account; this layer confirms
 * they're actually allowed to see THIS event — an admin always is, anyone
 * else only if event_commentator_assignments has an active row for them
 * (see lib/auth/eventRoles.ts / 0024_event_role_assignments.sql).
 */
export default async function CommentatorEventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");

  // A producer can also view the Commentator Dashboard for their assigned
  // event (spec: "Producer can view commentator dashboard") — checked as a
  // second, independent assignment rather than folding producer into
  // is_event_commentator itself, so the two roles' assignment rows stay
  // clean and separately auditable.
  const allowed =
    (await isAssignedToEvent(ctx, eventId, "commentator")) ||
    (await isAssignedToEvent(ctx, eventId, "producer"));
  if (!allowed) redirect("/commentator");

  const event = await getCommentatorEvent(eventId);
  if (!event) notFound();

  return (
    <OperatorShell
      module="commentator"
      moduleLabel="Commentator"
      eventName={event.name}
      tabs={
        <EventTabs
          ariaLabel="Event"
          items={TABS.map((t) => ({
            href: `/commentator/events/${eventId}/${t.slug}`,
            label: t.label,
          }))}
        />
      }
    >
      {children}
    </OperatorShell>
  );
}

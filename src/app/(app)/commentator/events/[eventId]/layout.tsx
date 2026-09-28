import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";
import { isAssignedToEvent } from "@/lib/auth/eventRoles";
import { createClient } from "@/lib/db/server";

const TABS = [
  { slug: "dashboard", label: "Dashboard" },
  { slug: "athletes", label: "Athletes" },
  { slug: "heats", label: "Heats" },
  { slug: "lanes", label: "Lanes" },
  { slug: "wods", label: "WODs" },
  { slug: "leaderboard", label: "Leaderboard" },
  { slug: "notes", label: "Notes" },
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
    (await isAssignedToEvent(ctx, eventId, "commentator")) || (await isAssignedToEvent(ctx, eventId, "producer"));
  if (!allowed) redirect("/commentator");

  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("id, name").eq("id", eventId).single();
  if (!event) notFound();

  return (
    <div className="flex flex-col gap-4">
      {/* Own header/tabs strip gets the page's standard width/padding;
          {children} (dashboard/athletes/heats/etc.) each manage their own —
          the dashboard tab in particular embeds CommentatorClient, which
          already brings its own mx-auto max-w-5xl px-4 py-6 wrapper, so
          duplicating that here would double the padding. */}
      <div className="mx-auto w-full max-w-5xl px-4 pt-6">
        <Link href="/commentator" className="text-xs uppercase tracking-wide text-white/40 hover:text-white">
          ← Choose a different event
        </Link>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-wide">
          {event.name}
        </h1>
        <nav className="mt-4 flex flex-wrap gap-2 border-b border-white/10 pb-3">
          {TABS.map((t) => (
            <Link
              key={t.slug}
              href={`/commentator/events/${eventId}/${t.slug}`}
              className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white/70 hover:bg-white/10 hover:text-white"
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}

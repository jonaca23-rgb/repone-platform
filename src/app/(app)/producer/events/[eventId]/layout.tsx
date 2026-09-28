import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";
import { isAssignedToEvent } from "@/lib/auth/eventRoles";
import { createClient } from "@/lib/db/server";

const TABS = [
  { slug: "dashboard", label: "Dashboard" },
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

  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("id, name").eq("id", eventId).single();
  if (!event) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div className="mx-auto w-full max-w-5xl px-4 pt-6">
        <Link href="/producer" className="text-xs uppercase tracking-wide text-white/40 hover:text-white">
          ← Choose a different event
        </Link>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-wide">
          {event.name}
        </h1>
        <nav className="mt-4 flex flex-wrap gap-2 border-b border-white/10 pb-3">
          {TABS.map((t) => (
            <Link
              key={t.slug}
              href={`/producer/events/${eventId}/${t.slug}`}
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

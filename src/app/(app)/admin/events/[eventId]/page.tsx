import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { updateEventStatus } from "@/lib/actions/events";
import type { EventStatus } from "@/lib/db/database.types";

const STATUSES: EventStatus[] = ["draft", "scheduled", "live", "completed", "archived"];

const SECTIONS = [
  { slug: "venues", label: "Venues & Floors", desc: "Physical venues and competition floors/platforms." },
  { slug: "divisions", label: "Divisions", desc: "Competitive categories for this event." },
  { slug: "athletes", label: "Athletes & Registrations", desc: "Assign athletes to divisions." },
  { slug: "wods", label: "WODs", desc: "Workouts, scoring type, time caps, tie-breaks." },
  { slug: "heats", label: "Heats & Lanes", desc: "Schedule heats and assign lane order." },
];

export default async function EventHubPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("*").eq("id", eventId).single();
  if (!event) notFound();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{event.name}</h1>
          <p className="text-sm text-black/50">
            {event.starts_on ?? "—"} {event.ends_on && event.ends_on !== event.starts_on ? `→ ${event.ends_on}` : ""}
          </p>
        </div>
        <form className="flex items-center gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              formAction={updateEventStatus.bind(null, eventId, s)}
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                event.status === s ? "bg-repone-red text-white" : "bg-black/5 text-black/50 hover:bg-black/10"
              }`}
            >
              {s}
            </button>
          ))}
        </form>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link
            key={s.slug}
            href={`/admin/events/${eventId}/${s.slug}`}
            className="rounded-lg border border-black/10 p-5 hover:border-repone-red"
          >
            <p className="font-semibold">{s.label}</p>
            <p className="mt-1 text-sm text-black/50">{s.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

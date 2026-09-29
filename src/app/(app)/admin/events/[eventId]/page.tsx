import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { updateEventStatus } from "@/lib/actions/events";
import { DeleteEventButton } from "@/app/(app)/admin/DeleteEventButton";
import type { EventStatus } from "@/lib/db/database.types";

const STATUSES: EventStatus[] = ["draft", "scheduled", "live", "completed", "archived"];

const SECTIONS = [
  {
    slug: "venues",
    label: "Venues & Floors",
    desc: "Physical venues and competition floors/platforms.",
  },
  { slug: "divisions", label: "Divisions", desc: "Competitive categories for this event." },
  { slug: "athletes", label: "Athletes & Registrations", desc: "Assign athletes to divisions." },
  { slug: "wods", label: "WODs", desc: "Workouts, scoring type, time caps, tie-breaks." },
  { slug: "heats", label: "Heats & Lanes", desc: "Schedule heats and assign lane order." },
  {
    slug: "staff",
    label: "Staff",
    desc: "Assign Scorekeepers, Producers, and Commentators to this event.",
  },
  {
    slug: "fees",
    label: "Fees",
    desc: "Registration fee schedules — individual, pair, team, add-ons.",
  },
  {
    slug: "payments",
    label: "Payments",
    desc: "Track who's paid. Manual ledger — no online charges yet.",
  },
  {
    slug: "statement",
    label: "Income & Expense Statement",
    desc: "Contrast fee income collected against event spending.",
  },
];

export default async function EventHubPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("*").eq("id", eventId).single();
  if (!event) notFound();

  const { data: circuit } = event.circuit_id
    ? await supabase.from("circuits").select("id, name").eq("id", event.circuit_id).single()
    : { data: null };

  // Once an organizer has uploaded a cover photo for this event (Events
  // page grid, 0011_event_cover_photo.sql), show it here too — as a banner
  // behind the event's own name/status/actions, so the picture they picked
  // to represent the event is visible on the event's home screen, not just
  // on the card the operator clicked in from.
  const coverUrl: string | null = event.cover_image_url ?? null;

  const header = (
    <div
      className={`flex flex-wrap items-start justify-between gap-4 ${coverUrl ? "text-white" : ""}`}
    >
      <div>
        <h1 className={`text-2xl font-bold sm:text-3xl ${coverUrl ? "drop-shadow-md" : ""}`}>
          {event.name}
        </h1>
        <p className={`text-sm ${coverUrl ? "text-white/80" : "text-black/50"}`}>
          {event.starts_on ?? "—"}{" "}
          {event.ends_on && event.ends_on !== event.starts_on ? `→ ${event.ends_on}` : ""}
        </p>
        {circuit ? (
          <Link
            href={`/admin/circuits/${circuit.id}`}
            className={`text-sm hover:underline ${coverUrl ? "text-white" : "text-repone-red"}`}
          >
            Part of circuit: {circuit.name} →
          </Link>
        ) : (
          <p className={`text-sm ${coverUrl ? "text-white/60" : "text-black/40"}`}>
            Standalone event — not part of a circuit.
          </p>
        )}
        <Link
          href={`/live/${eventId}`}
          target="_blank"
          className={`block text-sm hover:underline ${coverUrl ? "text-white" : "text-repone-red"}`}
        >
          Public Leaderboard (share this link) →
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <form className="flex flex-wrap items-center gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              formAction={updateEventStatus.bind(null, eventId, s)}
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                event.status === s
                  ? "bg-repone-red text-white"
                  : coverUrl
                    ? "bg-white/20 text-white hover:bg-white/30"
                    : "bg-black/5 text-black/50 hover:bg-black/10"
              }`}
            >
              {s}
            </button>
          ))}
        </form>
        <DeleteEventButton
          eventId={eventId}
          eventName={event.name}
          variant={coverUrl ? "dark" : "light"}
        />
      </div>
    </div>
  );

  return (
    <div>
      <p className="mb-4 text-sm">
        <Link href="/admin" className="text-repone-red underline">
          ← All Events
        </Link>
      </p>

      {coverUrl ? (
        <div className="relative mb-6 -mx-4 overflow-hidden sm:-mx-6 sm:rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, not a local/optimizable asset */}
          <img src={coverUrl} alt="" className="h-64 w-full object-cover sm:h-80" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/5" />
          <div className="absolute inset-0 flex items-end p-4 sm:p-6">{header}</div>
        </div>
      ) : (
        <div className="mb-6">{header}</div>
      )}

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

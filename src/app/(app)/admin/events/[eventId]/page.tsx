import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { DeleteEventButton } from "@/app/(app)/admin/DeleteEventButton";
import { PageHeader } from "@/components/app/PageHeader";
import { AdminBreadcrumb } from "@/components/shells/AdminBreadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminEvent } from "./adminEvent";
import { EventStatusControl } from "./EventStatusControl";

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

type Props = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { eventId } = await params;
  const event = await getAdminEvent(eventId);
  return { title: event ? `Overview · ${event.name}` : "Event" };
}

export default async function EventHubPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("*").eq("id", eventId).single();
  if (!event) notFound();

  const { data: circuit } = event.circuit_id
    ? await supabase.from("circuits").select("id, name").eq("id", event.circuit_id).single()
    : { data: null };

  // Once an organizer has uploaded a cover photo for this event (Events
  // page grid, 0011_event_cover_photo.sql), show it here too as a banner,
  // so the picture they picked is visible on the event's home screen.
  const coverUrl: string | null = event.cover_image_url ?? null;
  const dates =
    `${event.starts_on ?? "—"} ${event.ends_on && event.ends_on !== event.starts_on ? `→ ${event.ends_on}` : ""}`.trim();

  const statusControls = (
    <div className="flex flex-wrap items-center gap-2">
      <EventStatusControl eventId={eventId} eventName={event.name} status={event.status} />
      <DeleteEventButton eventId={eventId} eventName={event.name} />
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={event.name}
        description={dates}
        breadcrumb={
          <AdminBreadcrumb items={[{ label: "Events", href: "/admin" }, { label: event.name }]} />
        }
        actions={
          <Button asChild variant="outline">
            <Link href={`/live/${eventId}`} target="_blank">
              Public leaderboard
            </Link>
          </Button>
        }
      />

      {coverUrl ? (
        <div className="overflow-hidden rounded-xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, not a local/optimizable asset */}
          <img src={coverUrl} alt="" className="h-48 w-full object-cover sm:h-64" />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {circuit ? (
          <Link
            href={`/admin/circuits/${circuit.id}`}
            className="text-sm text-brand-text hover:underline"
          >
            Part of circuit: {circuit.name}
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">Standalone event, not part of a circuit.</p>
        )}
        {statusControls}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link
            key={s.slug}
            href={`/admin/events/${eventId}/${s.slug}`}
            className="rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
          >
            <Card size="sm" className="h-full hover:ring-primary/60">
              <CardHeader>
                <CardTitle>{s.label}</CardTitle>
                <CardDescription>{s.desc}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

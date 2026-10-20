import type { Metadata } from "next";
import { createClient } from "@/lib/db/server";
import { PageHeader } from "@/components/app/PageHeader";
import { AdminBreadcrumb, eventCrumbs } from "@/components/shells/AdminBreadcrumb";
import { getAdminEvent, requireAdminEvent } from "../adminEvent";
import { WodsTable } from "./WodsTable";

type Props = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await getAdminEvent((await params).eventId);
  return { title: event ? `WODs · ${event.name}` : "WODs" };
}

export default async function WodsPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const [event, { data: wods }] = await Promise.all([
    requireAdminEvent(eventId),
    supabase
      .from("wods")
      .select("id, name, scoring_type, time_cap_seconds, tiebreak_type, description, rules")
      .eq("event_id", eventId)
      .order("sort_order"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="WODs"
        description="Workouts, scoring type, time caps and tie-breaks."
        breadcrumb={<AdminBreadcrumb items={eventCrumbs(event, { label: "WODs" })} />}
      />

      <WodsTable eventId={eventId} rows={wods ?? []} />
    </div>
  );
}

import type { Metadata } from "next";
import { createClient } from "@/lib/db/server";
import { PageHeader } from "@/components/app/PageHeader";
import { AdminBreadcrumb, eventCrumbs } from "@/components/shells/AdminBreadcrumb";
import { getAdminEvent, requireAdminEvent } from "../adminEvent";
import { VenuesTable } from "./VenuesTable";

type Props = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await getAdminEvent((await params).eventId);
  return { title: event ? `Venues · ${event.name}` : "Venues" };
}

export default async function VenuesPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const [event, { data: venues }] = await Promise.all([
    requireAdminEvent(eventId),
    supabase
      .from("venues")
      .select("id, name, floors(id, name, sort_order)")
      .eq("event_id", eventId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Venues & floors"
        description="Every event gets a default venue and Floor A automatically. Add more floors here to run simultaneous competition floors or platforms."
        breadcrumb={<AdminBreadcrumb items={eventCrumbs(event, { label: "Venues" })} />}
      />

      <VenuesTable
        eventId={eventId}
        rows={(venues ?? []).map((v) => ({
          id: v.id,
          name: v.name,
          floors: [...(v.floors ?? [])].sort((x, y) => x.sort_order - y.sort_order),
        }))}
      />
    </div>
  );
}

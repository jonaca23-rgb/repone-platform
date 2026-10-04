import type { Metadata } from "next";
import { createClient } from "@/lib/db/server";
import { PageHeader } from "@/components/app/PageHeader";
import { AdminBreadcrumb, eventCrumbs } from "@/components/shells/AdminBreadcrumb";
import { getAdminEvent, requireAdminEvent } from "../adminEvent";
import { DivisionsTable } from "./DivisionsTable";

type Props = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await getAdminEvent((await params).eventId);
  return { title: event ? `Divisions · ${event.name}` : "Divisions" };
}

export default async function DivisionsPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const [event, { data: divisions }] = await Promise.all([
    requireAdminEvent(eventId),
    supabase.from("divisions").select("id, name").eq("event_id", eventId).order("sort_order"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Divisions"
        description="The competitive categories athletes and teams register into."
        breadcrumb={<AdminBreadcrumb items={eventCrumbs(event, { label: "Divisions" })} />}
      />

      <DivisionsTable eventId={eventId} rows={divisions ?? []} />
    </div>
  );
}

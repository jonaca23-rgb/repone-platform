import type { Metadata } from "next";
import { createClient } from "@/lib/db/server";
import type { CompetitorEntryType } from "@/lib/db/database.types";
import { PageHeader } from "@/components/app/PageHeader";
import { AdminBreadcrumb, eventCrumbs } from "@/components/shells/AdminBreadcrumb";
import { getAdminEvent, requireAdminEvent } from "../adminEvent";
import { type FeeRow, FeesTable } from "./FeesTable";

type Props = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await getAdminEvent((await params).eventId);
  return { title: event ? `Fees · ${event.name}` : "Fees" };
}

export default async function EventFeesPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();

  const [event, { data: divisions }, { data: feeSchedules }] = await Promise.all([
    requireAdminEvent(eventId),
    supabase.from("divisions").select("id, name").eq("event_id", eventId).order("sort_order"),
    supabase
      .from("fee_schedules")
      .select("id, name, description, division_id, entry_type, amount_cents, is_addon, active")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false }),
  ]);

  const divisionName = new Map((divisions ?? []).map((d) => [d.id, d.name]));
  const rows: FeeRow[] = (feeSchedules ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    description: f.description,
    amountCents: f.amount_cents,
    divisionId: f.division_id,
    divisionName: f.division_id ? (divisionName.get(f.division_id) ?? null) : null,
    entryType: f.entry_type as CompetitorEntryType | null,
    isAddon: f.is_addon,
    active: f.active,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Registration fees"
        description="What this event charges: the price menu the Payments page uses to record who owes what. No online payment is taken here and nothing talks to a payment processor; fees are recorded by hand. Leave Division or Entry type on Any to apply a fee broadly."
        breadcrumb={<AdminBreadcrumb items={eventCrumbs(event, { label: "Fees" })} />}
      />

      <FeesTable eventId={eventId} rows={rows} divisions={divisions ?? []} />
    </div>
  );
}

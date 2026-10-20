import type { Metadata } from "next";
import Link from "next/link";
import { ListOrdered } from "lucide-react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/db/server";
import { compareDivisionNames, compareHeatsForRunningOrder } from "@/lib/scoring/divisionOrder";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { AdminBreadcrumb, eventCrumbs } from "@/components/shells/AdminBreadcrumb";
import { Button } from "@/components/ui/button";
import { getAdminEvent, requireAdminEvent } from "../adminEvent";
import { type HeatRow, HeatsTable } from "./HeatsTable";

type Props = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await getAdminEvent((await params).eventId);
  return { title: event ? `Heats · ${event.name}` : "Heats" };
}

export default async function HeatsPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const cookieStore = await cookies();
  const lastLanesPerHeat =
    Number(cookieStore.get(`repone_lanes_per_heat_${eventId}`)?.value ?? 6) || 6;

  const [
    event,
    { data: floors },
    { data: wods },
    { data: divisions },
    { data: heats },
    { data: registrations },
  ] = await Promise.all([
    requireAdminEvent(eventId),
    supabase
      .from("floors")
      .select("id, name, venues!inner(event_id)")
      .eq("venues.event_id", eventId),
    // wods.sort_order has the same problem as divisions.sort_order — every
    // row defaults to 0 and nothing sets it, so it's a no-op. created_at is
    // "the order this WOD was entered," which is what Jonathan wants WODs
    // to run in (a WOD's name, unlike a division's, carries no ordering
    // information — see lib/scoring/divisionOrder.ts's file header).
    supabase
      .from("wods")
      .select("id, name, created_at")
      .eq("event_id", eventId)
      .order("created_at"),
    // divisions.sort_order defaults to 0 for every row (nothing sets it to
    // anything else), so the dropdowns below are re-sorted in JS by name
    // instead — see the compareDivisionNames sort just below this query.
    supabase.from("divisions").select("id, name").eq("event_id", eventId),
    supabase
      .from("heats")
      .select(
        "id, heat_number, heat_count, scheduled_start, ended_at, wod_id, division_id, floor_id, wods(name, created_at), divisions(name), floors(name), lanes(id)",
      )
      .eq("event_id", eventId),
    supabase.from("registrations").select("division_id").eq("event_id", eventId),
  ]);

  // Divisions run back-to-back in Jonathan's fixed running order (Scale
  // before Rx, Male before Female — see lib/scoring/divisionOrder.ts), used
  // both for the Floor/WOD/Division dropdowns below and for the heat list.
  const orderedDivisions = (divisions ?? [])
    .slice()
    .sort((a, b) => compareDivisionNames(a.name, b.name));

  // See lib/db/queries.ts header comment: cast many-to-one embeds back to single objects.
  const typedHeats = (
    (heats ?? []) as unknown as Array<{
      id: string;
      heat_number: number;
      heat_count: number | null;
      scheduled_start: string | null;
      ended_at: string | null;
      wods: { name: string; created_at: string } | null;
      divisions: { name: string } | null;
      wod_id: string;
      division_id: string;
      floor_id: string;
      floors: { name: string } | null;
      lanes: Array<{ id: string }> | null;
    }>
  )
    .slice()
    .sort((a, b) =>
      compareHeatsForRunningOrder(
        {
          wodCreatedAt: a.wods?.created_at ?? "",
          divisionName: a.divisions?.name ?? "",
          heatNumber: a.heat_number,
        },
        {
          wodCreatedAt: b.wods?.created_at ?? "",
          divisionName: b.divisions?.name ?? "",
          heatNumber: b.heat_number,
        },
      ),
    );

  const registrationCounts = new Map<string, number>();
  (registrations ?? []).forEach((r) => {
    registrationCounts.set(r.division_id, (registrationCounts.get(r.division_id) ?? 0) + 1);
  });

  // The first heat (in schedule order) that hasn't been finished yet — the
  // list highlights this one as "Next Up" so the operator always knows where
  // to go after wrapping up the current heat.
  const nextUpcomingId = typedHeats.find((h) => !h.ended_at)?.id ?? null;

  const canCreate =
    (floors?.length ?? 0) > 0 && (wods?.length ?? 0) > 0 && (divisions?.length ?? 0) > 0;

  const floorOptions = (floors ?? []).map((f) => ({ value: f.id, label: f.name }));
  const wodOptions = (wods ?? []).map((w) => ({ value: w.id, label: w.name }));

  const choices = {
    floors: floorOptions,
    wods: wodOptions,
    divisions: orderedDivisions.map((d) => ({
      value: d.id,
      label: `${d.name} (${registrationCounts.get(d.id) ?? 0} registered)`,
    })),
  };
  const rows: HeatRow[] = typedHeats.map((h) => ({
    id: h.id,
    label: `${h.wods?.name ?? "WOD"} — Heat ${h.heat_number}${h.heat_count ? ` / ${h.heat_count}` : ""}`,
    wodId: h.wod_id,
    divisionId: h.division_id,
    divisionName: h.divisions?.name ?? "—",
    floorId: h.floor_id,
    floorName: h.floors?.name ?? "—",
    lanes: h.lanes?.length ?? 0,
    start: h.scheduled_start,
    status: h.ended_at ? "completed" : h.id === nextUpcomingId ? "next" : "pending",
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Heats & lanes"
        description="Schedule heats in running order and assign lanes."
        breadcrumb={<AdminBreadcrumb items={eventCrumbs(event, { label: "Heats" })} />}
      />
      {!canCreate ? (
        <EmptyState
          icon={ListOrdered}
          title="Not ready for heats yet"
          description="Set up at least one floor, one WOD and one division before creating heats."
          action={
            <span className="flex flex-wrap justify-center gap-2">
              <Button asChild variant="outline">
                <Link href={`/admin/events/${eventId}/venues`}>Venues</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/admin/events/${eventId}/wods`}>WODs</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/admin/events/${eventId}/divisions`}>Divisions</Link>
              </Button>
            </span>
          }
        />
      ) : (
        <HeatsTable
          eventId={eventId}
          rows={rows}
          choices={choices}
          wods={wodOptions}
          lanesPerHeat={lastLanesPerHeat}
        />
      )}
    </div>
  );
}

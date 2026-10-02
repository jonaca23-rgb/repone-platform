import type { Metadata } from "next";
import Link from "next/link";
import { Check, ListOrdered } from "lucide-react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/db/server";
import { createHeat, deleteHeat, generateHeats } from "@/lib/actions/heats";
import { compareDivisionNames, compareHeatsForRunningOrder } from "@/lib/scoring/divisionOrder";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { AdminBreadcrumb, eventCrumbs } from "@/components/shells/AdminBreadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAdminEvent, requireAdminEvent } from "../adminEvent";

type Props = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await getAdminEvent((await params).eventId);
  return { title: event ? `Heats · ${event.name}` : "Heats" };
}

/** A required pick from a short list, defaulting to the first option as the native select did. */
function PickOne({
  id,
  name,
  label,
  options,
}: {
  id: string;
  name: string;
  label: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select name={name} required defaultValue={options[0]?.value}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
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
        "id, heat_number, heat_count, scheduled_start, ended_at, wods(name, created_at), divisions(name), floors(name), lanes(id)",
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
      ended_at: string | null;
      wods: { name: string; created_at: string } | null;
      divisions: { name: string } | null;
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Heats & lanes"
        description="Schedule heats and assign lane order."
        breadcrumb={<AdminBreadcrumb items={eventCrumbs(event, { label: "Heats" })} />}
      />

      {!canCreate ? (
        <EmptyState
          icon={ListOrdered}
          title="Not ready for heats yet"
          description="Set up at least one floor, one WOD and one division before creating heats."
        />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Generate heats</CardTitle>
              <CardDescription>
                Pick a floor, WOD and division and how many lanes run at once. Every athlete or team
                registered in that division is slotted into lanes automatically, across as many
                heats as it takes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                action={generateHeats.bind(null, eventId)}
                className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
              >
                <PickOne id="gen-floor" name="floor_id" label="Floor" options={floorOptions} />
                <PickOne id="gen-wod" name="wod_id" label="WOD" options={wodOptions} />
                <PickOne
                  id="gen-division"
                  name="division_id"
                  label="Division"
                  options={orderedDivisions.map((d) => ({
                    value: d.id,
                    label: `${d.name} (${registrationCounts.get(d.id) ?? 0} registered)`,
                  }))}
                />
                <div className="grid gap-2">
                  <Label htmlFor="gen-lanes">Lanes per heat</Label>
                  <Input
                    id="gen-lanes"
                    name="lanes_per_heat"
                    type="number"
                    min={1}
                    max={20}
                    defaultValue={lastLanesPerHeat}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="gen-start">First heat start</Label>
                  <Input id="gen-start" name="scheduled_start" type="datetime-local" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="gen-interval">Minutes between heats</Label>
                  <Input
                    id="gen-interval"
                    name="interval_minutes"
                    type="number"
                    min={0}
                    defaultValue={10}
                  />
                </div>
                <Button type="submit" className="self-end">
                  Generate heats
                </Button>
              </form>
            </CardContent>
          </Card>

          <details className="rounded-xl border border-border bg-card p-4">
            <summary className="cursor-pointer font-semibold">Add a single heat (manual)</summary>
            <form
              action={createHeat.bind(null, eventId)}
              className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              <PickOne id="add-floor" name="floor_id" label="Floor" options={floorOptions} />
              <PickOne id="add-wod" name="wod_id" label="WOD" options={wodOptions} />
              <PickOne
                id="add-division"
                name="division_id"
                label="Division"
                options={orderedDivisions.map((d) => ({ value: d.id, label: d.name }))}
              />
              <div className="grid gap-2">
                <Label htmlFor="add-number">Heat #</Label>
                <Input id="add-number" name="heat_number" type="number" min={1} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="add-count">Of (total heats)</Label>
                <Input id="add-count" name="heat_count" type="number" min={1} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="add-lanes">Lanes</Label>
                <Input
                  id="add-lanes"
                  name="lane_count"
                  type="number"
                  min={1}
                  max={20}
                  defaultValue={6}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="add-start">Scheduled start</Label>
                <Input id="add-start" name="scheduled_start" type="datetime-local" />
              </div>
              <Button type="submit" className="self-end">
                Add heat
              </Button>
            </form>
          </details>
        </>
      )}

      <div className="flex flex-col gap-2">
        {typedHeats.map((h) => {
          const completed = Boolean(h.ended_at);
          const isNextUp = h.id === nextUpcomingId;
          const label = `${h.wods?.name ?? "WOD"} — Heat ${h.heat_number}`;
          return (
            <div
              key={h.id}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3 ${
                isNextUp
                  ? "border-primary bg-primary/10 ring-1 ring-primary"
                  : completed
                    ? "border-border bg-background"
                    : "border-border bg-card"
              }`}
            >
              <Link href={`/admin/events/${eventId}/heats/${h.id}`} className="flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {label}
                  {h.heat_count ? ` / ${h.heat_count}` : ""}
                  {completed && (
                    <Badge className="border-success/40 bg-success/10 text-success-text uppercase">
                      <Check aria-hidden />
                      Completed
                    </Badge>
                  )}
                  {isNextUp && <Badge className="uppercase">Next up</Badge>}
                </p>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {h.divisions?.name} · {h.floors?.name} · {h.lanes?.length ?? 0} lanes
                </p>
              </Link>
              <ConfirmAction
                trigger="Remove"
                title={`Remove ${label}?`}
                description="The heat is deleted with its lane assignments and any results entered for it. This cannot be undone."
                confirmLabel="Remove heat"
                onConfirm={deleteHeat.bind(null, eventId, h.id)}
              />
            </div>
          );
        })}
        {heats?.length === 0 && canCreate && (
          <EmptyState
            icon={ListOrdered}
            title="No heats yet"
            description="Generate heats for a division with the form above."
          />
        )}
      </div>
    </div>
  );
}

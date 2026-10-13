import type { Metadata } from "next";
import { createClient } from "@/lib/db/server";
import type { EntryFormat } from "@/lib/teams/format";
import { PageHeader } from "@/components/app/PageHeader";
import { AdminBreadcrumb, eventCrumbs } from "@/components/shells/AdminBreadcrumb";
import { getAdminEvent, requireAdminEvent } from "../adminEvent";
import { type TeamRow, TeamsTable } from "./TeamsTable";

type Props = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await getAdminEvent((await params).eventId);
  return { title: event ? `Teams · ${event.name}` : "Teams" };
}

interface RawTeam {
  id: string;
  name: string;
  affiliate: string | null;
  division_id: string;
  captain_athlete_id: string | null;
  divisions: { name: string; team_size: number | null } | null;
  team_members: Array<{
    id: string;
    athlete_id: string;
    athletes: { first_name: string; last_name: string } | null;
  }>;
}

/**
 * The event's teams (0036): each lives in one of the event's team divisions,
 * is made of the organization's athletes, and an athlete is on one team per
 * event. Creating a team registers it, so its fee shows under Payments.
 */
export default async function EventTeamsPage({ params }: Props) {
  const { eventId } = await params;
  const event = await requireAdminEvent(eventId);
  const supabase = await createClient();

  const [teams, divisions, owner] = await Promise.all([
    supabase
      .from("teams")
      .select(
        "id, name, affiliate, division_id, captain_athlete_id, divisions(name, team_size), team_members(id, athlete_id, athletes(first_name, last_name))",
      )
      .eq("event_id", eventId)
      .order("name"),
    supabase
      .from("divisions")
      .select("id, name, entry_format, team_size")
      .eq("event_id", eventId)
      .neq("entry_format", "individual")
      .order("sort_order"),
    supabase.from("events").select("organization_id").eq("id", eventId).single(),
  ]);
  for (const r of [teams, divisions, owner]) if (r.error) throw new Error(r.error.message);

  const { data: athletes, error: athletesError } = await supabase
    .from("athletes")
    .select("id, first_name, last_name, affiliate")
    .eq("organization_id", owner.data?.organization_id ?? "")
    .order("last_name")
    .order("first_name");
  if (athletesError) throw new Error(athletesError.message);

  const raw = (teams.data ?? []) as unknown as RawTeam[];
  const onATeam = new Set(raw.flatMap((t) => t.team_members.map((m) => m.athlete_id)));
  const available = (athletes ?? [])
    .filter((a) => !onATeam.has(a.id))
    .map((a) => ({
      id: a.id,
      // Two athletes can share a name; the box tells them apart.
      label: `${a.first_name} ${a.last_name}${a.affiliate ? ` (${a.affiliate})` : ""}`,
    }));

  const rows: TeamRow[] = raw.map((t) => ({
    id: t.id,
    name: t.name,
    affiliate: t.affiliate,
    divisionId: t.division_id,
    divisionName: t.divisions?.name ?? "Unknown division",
    size: t.divisions?.team_size ?? null,
    captainId: t.captain_athlete_id,
    roster: t.team_members
      .map((m) => ({
        memberId: m.id,
        athleteId: m.athlete_id,
        name: m.athletes ? `${m.athletes.first_name} ${m.athletes.last_name}` : "Unknown athlete",
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Teams"
        description={`The teams competing at ${event.name}. An athlete is on one team per event, and each team pays one fee.`}
        breadcrumb={<AdminBreadcrumb items={eventCrumbs(event, { label: "Teams" })} />}
      />
      <TeamsTable
        eventId={eventId}
        rows={rows}
        divisions={(divisions.data ?? []).map((d) => ({
          id: d.id,
          name: d.name,
          format: d.entry_format as EntryFormat,
          size: d.team_size,
        }))}
        available={available}
      />
    </div>
  );
}

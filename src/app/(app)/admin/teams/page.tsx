import type { Metadata } from "next";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import type { EntryFormat } from "@/lib/db/database.types";
import { PageHeader } from "@/components/app/PageHeader";
import { type TeamRow, TeamsTable } from "./TeamsTable";

export const metadata: Metadata = { title: "Teams" };

export default async function TeamsPage() {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const [{ data: teams }, { data: athletes }, { data: members }] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name, affiliate, entry_format, team_size")
      .eq("organization_id", ctx?.organizationId ?? "")
      .order("name"),
    supabase
      .from("athletes")
      .select("id, first_name, last_name, affiliate")
      .eq("organization_id", ctx?.organizationId ?? "")
      .order("last_name"),
    supabase
      .from("team_members")
      .select("id, team_id, athletes(id, first_name, last_name, affiliate)"),
  ]);

  const typedMembers = (members ?? []) as unknown as Array<{
    id: string;
    team_id: string;
    athletes: {
      id: string;
      first_name: string;
      last_name: string;
      affiliate: string | null;
    } | null;
  }>;

  const athleteLabel = (a: { first_name: string; last_name: string; affiliate: string | null }) =>
    `${a.first_name} ${a.last_name}${a.affiliate ? ` (${a.affiliate})` : ""}`;
  const rows: TeamRow[] = (teams ?? []).map((t) => {
    const roster = typedMembers.filter((m) => m.team_id === t.id && m.athletes);
    const onTeam = new Set(roster.map((m) => m.athletes!.id));
    return {
      id: t.id,
      name: t.name,
      affiliate: t.affiliate,
      format: t.entry_format as EntryFormat,
      size: t.team_size,
      roster: roster.map((m) => ({
        memberId: m.id,
        name: `${m.athletes!.first_name} ${m.athletes!.last_name}`,
      })),
      available: (athletes ?? [])
        .filter((a) => !onTeam.has(a.id))
        .map((a) => ({ id: a.id, label: athleteLabel(a) })),
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Teams"
        description="Your organization's team pool: pairs, teams, or any custom format built from athletes on your roster. Register a team into a division from that event's Athletes page. Entry format and headcount are for display and fee-matching only; no roster size is enforced."
      />
      <TeamsTable rows={rows} />
    </div>
  );
}

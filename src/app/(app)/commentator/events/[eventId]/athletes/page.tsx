import type { Metadata } from "next";
import { createClient } from "@/lib/db/server";
import { PageHeader } from "@/components/app/PageHeader";
import { commentatorEventTitle } from "../commentatorEvent";
import { type CommentatorAthleteRow, CommentatorAthletesTable } from "./CommentatorAthletesTable";

type Props = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: await commentatorEventTitle((await params).eventId, "Athletes") };
}

// Read-only roster for this event — name, affiliate/box, division, bib —
// so a commentator can look someone up ahead of their heat without leaving
// the tree. Full stats/history for whoever's actually up next already show
// on the Dashboard tab; this is for browsing everyone else.
export default async function CommentatorEventAthletesPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();

  const { data: registrations } = await supabase
    .from("registrations")
    .select(
      "id, bib_number, divisions(name), athletes(id, first_name, last_name, affiliate), teams(name, affiliate)",
    )
    .eq("event_id", eventId);

  type Row = {
    id: string;
    bib_number: string | null;
    divisions: { name: string } | null;
    athletes: {
      id: string;
      first_name: string;
      last_name: string;
      affiliate: string | null;
    } | null;
    teams: { name: string; affiliate: string | null } | null;
  };
  const tableRows: CommentatorAthleteRow[] = ((registrations ?? []) as unknown as Row[]).map(
    (r) => ({
      id: r.id,
      name: r.athletes
        ? `${r.athletes.first_name} ${r.athletes.last_name}`
        : (r.teams?.name ?? "—"),
      sortName: r.athletes
        ? `${r.athletes.last_name} ${r.athletes.first_name}`
        : (r.teams?.name ?? ""),
      bib: r.bib_number,
      division: r.divisions?.name ?? "—",
      affiliate: r.athletes?.affiliate ?? r.teams?.affiliate ?? null,
    }),
  );
  const divisions = [...new Set(tableRows.map((r) => r.division))].sort();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <PageHeader title="Athletes" />
      <CommentatorAthletesTable rows={tableRows} divisions={divisions} />
    </div>
  );
}

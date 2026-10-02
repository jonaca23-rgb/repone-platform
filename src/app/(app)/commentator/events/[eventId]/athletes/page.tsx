import type { Metadata } from "next";
import { Users } from "lucide-react";
import { createClient } from "@/lib/db/server";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { commentatorEventTitle } from "../commentatorEvent";

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
  const rows = ((registrations ?? []) as unknown as Row[]).sort((a, b) => {
    const nameA = a.athletes
      ? `${a.athletes.last_name} ${a.athletes.first_name}`
      : (a.teams?.name ?? "");
    const nameB = b.athletes
      ? `${b.athletes.last_name} ${b.athletes.first_name}`
      : (b.teams?.name ?? "");
    return nameA.localeCompare(nameB);
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <PageHeader title="Athletes" />
      {rows.length > 0 ? (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => {
            const name = r.athletes
              ? `${r.athletes.first_name} ${r.athletes.last_name}`
              : (r.teams?.name ?? "—");
            const affiliate = r.athletes?.affiliate ?? r.teams?.affiliate ?? null;
            return (
              <li key={r.id}>
                <Card size="sm" className="h-full">
                  <CardContent>
                    <p className="font-semibold">
                      {name}
                      {r.bib_number && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          #{r.bib_number}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.divisions?.name ?? "—"}
                      {affiliate ? ` · ${affiliate}` : ""}
                    </p>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={Users} title="No athletes registered for this event yet" />
      )}
    </div>
  );
}

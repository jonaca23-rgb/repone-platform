import type { Metadata } from "next";
import { UsersRound, X } from "lucide-react";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { createTeam, deleteTeam, addTeamMember, removeTeamMember } from "@/lib/actions/teams";
import type { EntryFormat } from "@/lib/db/database.types";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const metadata: Metadata = { title: "Teams" };

const ENTRY_FORMAT_LABELS: Record<EntryFormat, string> = {
  pair: "Pair",
  team: "Team",
  custom: "Custom format",
};

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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Teams"
        description="Your organization's team pool: pairs, teams, or any custom competitor format built from athletes on your roster. Register a team into a division from that event's Athletes page. Entry format and headcount are for display and fee-matching only; no roster size is enforced."
      />

      <Card>
        <CardContent>
          <form action={createTeam} className="flex flex-wrap items-end gap-3">
            <div className="grid gap-2">
              <Label htmlFor="team-name">Team name</Label>
              <Input id="team-name" name="name" required placeholder="Box Wolves" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="team-affiliate">Box / affiliate</Label>
              <Input id="team-affiliate" name="affiliate" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="team-format">Entry format</Label>
              <Select name="entry_format" defaultValue="team">
                <SelectTrigger id="team-format" className="min-w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ENTRY_FORMAT_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="team-size">Headcount (optional)</Label>
              <Input
                id="team-size"
                name="team_size"
                type="number"
                min={1}
                placeholder="e.g. 4"
                className="w-28"
              />
            </div>
            <Button type="submit">Add team</Button>
          </form>
        </CardContent>
      </Card>

      {teams?.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No teams yet"
          description="Create your first team with the form above."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {(teams ?? []).map((t) => {
            const roster = typedMembers.filter((m) => m.team_id === t.id);
            const rosterAthleteIds = new Set(roster.map((m) => m.athletes?.id));
            const available = (athletes ?? []).filter((a) => !rosterAthleteIds.has(a.id));

            return (
              <Card key={t.id} size="sm">
                <CardContent className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-base font-semibold">
                        {t.name}
                        {t.affiliate ? (
                          <span className="ml-2 text-sm font-normal text-muted-foreground">
                            {t.affiliate}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {ENTRY_FORMAT_LABELS[t.entry_format as EntryFormat]}
                        {t.team_size ? ` · ${t.team_size} roster spots` : ""} · {roster.length} on
                        roster now
                      </p>
                    </div>
                    <ConfirmAction
                      trigger="Delete team"
                      title={`Delete ${t.name}?`}
                      description="The team and its roster are deleted, along with its registrations and results. The athletes stay on your roster. This cannot be undone."
                      confirmLabel="Delete team"
                      onConfirm={deleteTeam.bind(null, t.id)}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {roster.map((m) => {
                      const name =
                        `${m.athletes?.first_name ?? ""} ${m.athletes?.last_name ?? ""}`.trim();
                      return (
                        <Badge
                          key={m.id}
                          variant="secondary"
                          className="h-auto gap-0 py-0 pr-0 text-sm"
                        >
                          {name}
                          <ConfirmAction
                            trigger={
                              <>
                                <X aria-hidden />
                                <span className="sr-only">Remove {name} from the roster</span>
                              </>
                            }
                            title={`Remove ${name} from ${t.name}?`}
                            description="They come off this team's roster. They stay on your athlete roster and can be added back."
                            confirmLabel="Remove from roster"
                            onConfirm={removeTeamMember.bind(null, m.id)}
                          />
                        </Badge>
                      );
                    })}
                    {roster.length === 0 && (
                      <span className="text-sm text-muted-foreground">No roster members yet.</span>
                    )}
                  </div>

                  {available.length > 0 && (
                    <form
                      action={addTeamMember.bind(null, t.id)}
                      className="flex flex-wrap items-end gap-2"
                    >
                      <div className="grid gap-2">
                        <Label htmlFor={`roster-${t.id}`} className="sr-only">
                          Athlete to add to {t.name}
                        </Label>
                        <Select name="athlete_id" defaultValue={available[0].id}>
                          <SelectTrigger id={`roster-${t.id}`} className="min-w-56">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {available.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.first_name} {a.last_name}
                                {a.affiliate ? ` (${a.affiliate})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button type="submit" variant="outline">
                        Add to roster
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

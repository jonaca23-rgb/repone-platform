"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { registerAthlete, registerTeam } from "@/lib/actions/registrations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AthleteOption {
  id: string;
  first_name: string;
  last_name: string;
  affiliate: string | null;
}
interface TeamOption {
  id: string;
  name: string;
  affiliate: string | null;
}
interface DivisionOption {
  id: string;
  name: string;
}

function DivisionSelect({
  id,
  divisions,
  defaultValue,
}: {
  id: string;
  divisions: DivisionOption[];
  defaultValue: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Division</Label>
      <Select name="division_id" required defaultValue={defaultValue}>
        <SelectTrigger id={id} className="min-w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {divisions.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * The two "register someone into this event" forms (individual + team).
 * Client Components so a duplicate registration comes back as a toast and an
 * inline message instead of Next's full-page error overlay:
 * registerAthlete/registerTeam return `{ error }` instead of throwing.
 */
export function RegisterForms({
  eventId,
  athletes,
  teams,
  divisions,
  lastDivisionId,
}: {
  eventId: string;
  athletes: AthleteOption[];
  teams: TeamOption[];
  divisions: DivisionOption[];
  lastDivisionId: string;
}) {
  const [athleteState, athleteFormAction, athletePending] = useActionState(
    registerAthlete.bind(null, eventId),
    { error: "" },
  );
  const [teamState, teamFormAction, teamPending] = useActionState(
    registerTeam.bind(null, eventId),
    { error: "" },
  );

  // The division last registered into (a cookie set by the action), so a run
  // of registrations into one division doesn't need re-picking each time.
  const defaultDivision = divisions.some((d) => d.id === lastDivisionId)
    ? lastDivisionId
    : (divisions[0]?.id ?? "");

  const lastAthleteError = useRef("");
  const lastTeamError = useRef("");

  useEffect(() => {
    if (athleteState.error && athleteState.error !== lastAthleteError.current) {
      lastAthleteError.current = athleteState.error;
      toast.error(athleteState.error);
    }
  }, [athleteState.error]);

  useEffect(() => {
    if (teamState.error && teamState.error !== lastTeamError.current) {
      lastTeamError.current = teamState.error;
      toast.error(teamState.error);
    }
  }, [teamState.error]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Register an athlete</CardTitle>
        </CardHeader>
        <CardContent>
          {athletes.length > 0 ? (
            <form action={athleteFormAction} className="flex flex-wrap items-end gap-3">
              <div className="grid gap-2">
                <Label htmlFor="register-athlete">Athlete</Label>
                <Select name="athlete_id" required defaultValue={athletes[0].id}>
                  <SelectTrigger id="register-athlete" className="min-w-52">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {athletes.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.first_name} {a.last_name}
                        {a.affiliate ? ` (${a.affiliate})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DivisionSelect
                id="register-athlete-division"
                divisions={divisions}
                defaultValue={defaultDivision}
              />
              <div className="grid gap-2">
                <Label htmlFor="register-athlete-bib">Bib #</Label>
                <Input id="register-athlete-bib" name="bib_number" className="w-24 text-base" />
              </div>
              <Button type="submit" disabled={athletePending}>
                {athletePending ? "Registering…" : "Register"}
              </Button>
              {athleteState.error && (
                <p role="alert" className="w-full text-sm font-semibold text-destructive">
                  {athleteState.error}
                </p>
              )}
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              No athletes yet. Add them on the{" "}
              <Link href="/admin/athletes" className="text-brand-text underline">
                Athletes
              </Link>{" "}
              page first.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Register a pair, team or custom entry</CardTitle>
        </CardHeader>
        <CardContent>
          {teams.length > 0 ? (
            <form action={teamFormAction} className="flex flex-wrap items-end gap-3">
              <div className="grid gap-2">
                <Label htmlFor="register-team">Team</Label>
                <Select name="team_id" required defaultValue={teams[0].id}>
                  <SelectTrigger id="register-team" className="min-w-52">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                        {t.affiliate ? ` (${t.affiliate})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DivisionSelect
                id="register-team-division"
                divisions={divisions}
                defaultValue={defaultDivision}
              />
              <div className="grid gap-2">
                <Label htmlFor="register-team-bib">Bib #</Label>
                <Input id="register-team-bib" name="bib_number" className="w-24 text-base" />
              </div>
              <Button type="submit" disabled={teamPending}>
                {teamPending ? "Registering…" : "Register"}
              </Button>
              {teamState.error && (
                <p role="alert" className="w-full text-sm font-semibold text-destructive">
                  {teamState.error}
                </p>
              )}
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              No teams yet. Create one on the{" "}
              <Link href="/admin/teams" className="text-brand-text underline">
                Teams
              </Link>{" "}
              page first.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { registerAthlete, registerTeam } from "@/lib/actions/registrations";

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

/**
 * The two "register someone into this event" forms (individual + team).
 * Client Components (not plain server-action `<form>`s) so a duplicate
 * registration attempt comes back as a normal, dismissable alert instead of
 * crashing into Next's full-page error overlay — registerAthlete/registerTeam
 * now return `{ error }` instead of throwing, and `useActionState` surfaces
 * it both inline and via `window.alert`.
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
  const [athleteState, athleteFormAction, athletePending] = useActionState(registerAthlete.bind(null, eventId), {
    error: "",
  });
  const [teamState, teamFormAction, teamPending] = useActionState(registerTeam.bind(null, eventId), { error: "" });

  const lastAthleteAlert = useRef("");
  const lastTeamAlert = useRef("");

  useEffect(() => {
    if (athleteState.error && athleteState.error !== lastAthleteAlert.current) {
      lastAthleteAlert.current = athleteState.error;
      window.alert(athleteState.error);
    }
  }, [athleteState.error]);

  useEffect(() => {
    if (teamState.error && teamState.error !== lastTeamAlert.current) {
      lastTeamAlert.current = teamState.error;
      window.alert(teamState.error);
    }
  }, [teamState.error]);

  return (
    <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <form action={athleteFormAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-black/10 p-4">
        <p className="w-full text-xs font-bold uppercase tracking-wide text-black/40">Register an athlete</p>
        <label className="flex flex-col gap-1 text-sm">
          Athlete
          <select name="athlete_id" required className="rounded-md border border-black/20 px-3 py-2">
            {athletes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.first_name} {a.last_name} {a.affiliate ? `(${a.affiliate})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Division
          <select name="division_id" required defaultValue={lastDivisionId} className="rounded-md border border-black/20 px-3 py-2">
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Bib #
          <input name="bib_number" className="w-20 rounded-md border border-black/20 px-3 py-2" />
        </label>
        <button disabled={athletePending} className="control-btn control-btn-red px-6 py-3 text-base disabled:opacity-50">
          {athletePending ? "Registering…" : "Register"}
        </button>
        {athleteState.error && <p className="w-full text-sm font-semibold text-red-600">⚠ {athleteState.error}</p>}
      </form>

      <form action={teamFormAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-black/10 p-4">
        <p className="w-full text-xs font-bold uppercase tracking-wide text-black/40">Register a pair / team / custom entry</p>
        {teams.length > 0 ? (
          <>
            <label className="flex flex-col gap-1 text-sm">
              Team
              <select name="team_id" required className="rounded-md border border-black/20 px-3 py-2">
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.affiliate ? `(${t.affiliate})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Division
              <select name="division_id" required defaultValue={lastDivisionId} className="rounded-md border border-black/20 px-3 py-2">
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Bib #
              <input name="bib_number" className="w-20 rounded-md border border-black/20 px-3 py-2" />
            </label>
            <button disabled={teamPending} className="control-btn control-btn-red px-6 py-3 text-base disabled:opacity-50">
              {teamPending ? "Registering…" : "Register"}
            </button>
            {teamState.error && <p className="w-full text-sm font-semibold text-red-600">⚠ {teamState.error}</p>}
          </>
        ) : (
          <p className="text-sm text-black/50">
            No teams yet — create one on the{" "}
            <Link href="/admin/teams" className="text-repone-red underline">
              Teams
            </Link>{" "}
            page first.
          </p>
        )}
      </form>
    </div>
  );
}

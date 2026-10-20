// An athlete's events: their own registrations, plus the registration of
// each team they are on (0036), which is where a team member's fee is paid.

/** "Intermediate Female", or "Pairs · Team Aprieta Duo" for a team's registration. */
export function registrationLabel(row: {
  divisions: { name: string } | null;
  teams: { name: string } | null;
}): string {
  const division = row.divisions?.name ?? "—";
  return row.teams ? `${division} · Team ${row.teams.name}` : division;
}

/**
 * The registration whose standing the athlete's dashboard shows: a live
 * event first, then the most recently started one. Null with none.
 *
 * An athlete can be registered on their own and on a team in the same event
 * (0036). In a live event their own registration wins: the dashboard's card
 * is "your standing", and the team's shows on its own registration row.
 */
export function chooseCurrentRegistration<
  R extends {
    events: { status: string; starts_on: string | null } | null;
    teams?: unknown;
  },
>(rows: R[]): R | null {
  const withEvents = rows.filter((r) => r.events);
  const live = withEvents.filter((r) => r.events?.status === "live");
  if (live.length) return live.find((r) => !r.teams) ?? live[0];
  return (
    [...withEvents].sort((a, b) =>
      (b.events?.starts_on ?? "").localeCompare(a.events?.starts_on ?? ""),
    )[0] ?? null
  );
}

/**
 * Who a standings row belongs to across a circuit's events. An athlete is the
 * same record at every stop, so their id does. A team is created per event
 * (0036), so the same team has a different id at each stop: it is matched by
 * its name instead, ignoring case and spacing. Two teams that share a name in
 * the same division at different stops count as one.
 */
export function circuitCompetitorKey(row: {
  athleteId: string | null;
  teamId: string | null;
  teamName: string | null;
}): string | null {
  if (row.athleteId) return row.athleteId;
  if (!row.teamId) return null;
  const name = row.teamName?.trim().replace(/\s+/g, " ").toLowerCase();
  return name ? `team:${name}` : row.teamId;
}

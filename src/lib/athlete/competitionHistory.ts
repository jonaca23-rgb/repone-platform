import { registrationLabel } from "./myRegistrations";

export interface AthleteHistoryGroup {
  /** One per event for the athlete's own results, and one per team they competed on. */
  key: string;
  /** A team's results: the standing is the team's, not the athlete's. */
  isTeam: boolean;
  eventId: string;
  eventName: string;
  startsOn: string | null;
  /** The division, or "Pairs · Team Aprieta Duo" for a team's results. */
  divisionName: string;
  overall: { standingId: string; placement: number | null; points: number | null } | null;
  wods: {
    standingId: string;
    wodId: string;
    name: string;
    sortOrder: number;
    placement: number | null;
  }[];
}

export interface HistoryStandingRow {
  id: string;
  event_id: string;
  division_id: string;
  wod_id: string | null;
  team_id: string | null;
  placement: number | null;
  points: number | null;
  teams: { name: string } | null;
}

/**
 * An athlete's standings rows, their own and their teams' (0036), grouped
 * into one entry per event and competitor: most recent event first, their
 * own results before a team's, WODs in program order. A row whose event
 * isn't among `events` is dropped.
 */
export function groupCompetitionHistory(
  rows: HistoryStandingRow[],
  lookups: {
    events: { id: string; name: string; starts_on: string | null }[];
    divisions: { id: string; name: string }[];
    wods: { id: string; name: string; sort_order: number }[];
  },
): AthleteHistoryGroup[] {
  const eventById = new Map(lookups.events.map((e) => [e.id, e]));
  const divisionById = new Map(lookups.divisions.map((d) => [d.id, d]));
  const wodById = new Map(lookups.wods.map((w) => [w.id, w]));

  const groups = new Map<string, AthleteHistoryGroup>();
  for (const row of rows) {
    const event = eventById.get(row.event_id);
    if (!event) continue;
    const key = `${row.event_id}:${row.team_id ?? "own"}`;
    const group: AthleteHistoryGroup = groups.get(key) ?? {
      key,
      isTeam: row.team_id !== null,
      eventId: row.event_id,
      eventName: event.name,
      startsOn: event.starts_on,
      divisionName: registrationLabel({
        divisions: divisionById.get(row.division_id) ?? null,
        teams: row.team_id ? row.teams : null,
      }),
      overall: null,
      wods: [],
    };
    if (row.wod_id === null) {
      group.overall = { standingId: row.id, placement: row.placement, points: row.points };
    } else {
      const wod = wodById.get(row.wod_id);
      group.wods.push({
        standingId: row.id,
        wodId: row.wod_id,
        name: wod?.name ?? "WOD",
        sortOrder: wod?.sort_order ?? 0,
        placement: row.placement,
      });
    }
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((g) => ({ ...g, wods: g.wods.sort((a, b) => a.sortOrder - b.sortOrder) }))
    .sort(
      (a, b) =>
        (b.startsOn ?? "").localeCompare(a.startsOn ?? "") ||
        a.eventId.localeCompare(b.eventId) ||
        Number(a.isTeam) - Number(b.isTeam),
    );
}

/**
 * The groups of an athlete's `n` most recent events, every result of each:
 * an event where they competed on their own and on a team counts once.
 * `history` is most recent first, as groupCompetitionHistory returns it.
 */
export function recentEvents<G extends { eventId: string }>(history: G[], n: number): G[] {
  const kept = new Set<string>();
  return history.filter((g) => {
    if (kept.has(g.eventId)) return true;
    if (kept.size >= n) return false;
    kept.add(g.eventId);
    return true;
  });
}

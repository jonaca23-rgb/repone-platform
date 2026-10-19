// A lane holds one athlete or one team (lanes.athlete_id / team_id, never
// both). Every screen that shows a heat's lanes reads them through this one
// select and mapper, so a team's lane shows the team everywhere.

/** One lane of a heat, as every floor screen shows it. */
export interface FloorLane {
  laneNumber: number;
  athleteId: string | null;
  teamId: string | null;
  /** The athlete's full name, or the team's name. */
  name: string | null;
  /** The athlete's affiliate, or the team's. */
  affiliate: string | null;
  /** A team's member names, by name; empty for an athlete or an empty lane. */
  members: string[];
}

export const FLOOR_LANES_SELECT =
  "lane_number, athlete_id, team_id, athletes(first_name, last_name, affiliate), teams(name, affiliate, team_members(athletes(first_name, last_name)))";

/** A lane row as FLOOR_LANES_SELECT returns it. */
export interface RawLane {
  lane_number: number;
  athlete_id: string | null;
  team_id: string | null;
  athletes: { first_name: string; last_name: string; affiliate: string | null } | null;
  teams: {
    name: string;
    affiliate: string | null;
    team_members: Array<{ athletes: { first_name: string; last_name: string } | null }>;
  } | null;
}

const fullName = (p: { first_name: string; last_name: string }) => `${p.first_name} ${p.last_name}`;

export function toFloorLanes(raw: RawLane[] | null): FloorLane[] {
  return (raw ?? [])
    .slice()
    .sort((a, b) => a.lane_number - b.lane_number)
    .map((l) => ({
      laneNumber: l.lane_number,
      athleteId: l.athlete_id,
      teamId: l.team_id,
      name: l.athletes ? fullName(l.athletes) : (l.teams?.name ?? null),
      affiliate: l.athletes ? l.athletes.affiliate : (l.teams?.affiliate ?? null),
      members: l.teams
        ? l.teams.team_members
            .flatMap((m) => (m.athletes ? [fullName(m.athletes)] : []))
            .sort((a, b) => a.localeCompare(b))
        : [],
    }));
}

/** Who is in a lane, for scoring and result lookups; null for an empty lane. */
export function laneCompetitor(
  lane: Pick<FloorLane, "athleteId" | "teamId">,
): { type: "athlete" | "team"; id: string } | null {
  if (lane.athleteId) return { type: "athlete", id: lane.athleteId };
  if (lane.teamId) return { type: "team", id: lane.teamId };
  return null;
}

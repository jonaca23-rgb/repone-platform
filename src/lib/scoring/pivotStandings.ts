export interface RawStandingRow {
  wod_id: string | null;
  placement: number | null;
  points: number | null;
  athlete_id: string | null;
  team_id: string | null;
  athletes: { first_name: string; last_name: string } | null;
  teams: { name: string } | null;
  wods: { id: string; name: string; created_at: string } | null;
}

export interface StandingsWod {
  id: string;
  name: string;
}

export interface DivisionStandingRow {
  /** The athlete's or team's id. */
  key: string;
  placement: number | null;
  points: number | null;
  name: string;
  /** Placing in each WOD, by WOD id. */
  wodPlacements: Record<string, number | null>;
}

/**
 * A division's standings rows (overall and per WOD, as stored) turned into one
 * row per competitor with a placing for each WOD. The overall row is the
 * leaderboard: a competitor with only per-WOD rows is left out. WOD columns
 * follow running order (created_at), as in divisionOrder.ts.
 */
export function pivotStandings(raw: RawStandingRow[]): {
  wods: StandingsWod[];
  rows: DivisionStandingRow[];
} {
  const wods = new Map<string, { id: string; name: string; created_at: string }>();
  const byKey = new Map<string, DivisionStandingRow>();
  const placings: Array<{ key: string; wodId: string; placement: number | null }> = [];

  for (const r of raw) {
    const key = r.athlete_id ?? r.team_id;
    if (!key) continue;
    if (r.wod_id === null) {
      byKey.set(key, {
        key,
        placement: r.placement,
        points: r.points,
        name: r.athletes
          ? `${r.athletes.first_name} ${r.athletes.last_name}`
          : (r.teams?.name ?? "—"),
        wodPlacements: {},
      });
    } else {
      if (r.wods) wods.set(r.wod_id, r.wods);
      placings.push({ key, wodId: r.wod_id, placement: r.placement });
    }
  }
  for (const p of placings) {
    const competitor = byKey.get(p.key);
    if (competitor) competitor.wodPlacements[p.wodId] = p.placement;
  }

  const rows = [...byKey.values()].sort((a, b) => {
    if (a.placement === null && b.placement === null) return a.name.localeCompare(b.name, "es");
    if (a.placement === null) return 1;
    if (b.placement === null) return -1;
    return a.placement - b.placement;
  });
  return {
    wods: [...wods.values()]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(({ id, name }) => ({ id, name })),
    rows,
  };
}

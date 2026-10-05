import { describe, expect, it } from "vitest";
import { pivotStandings, type RawStandingRow } from "./pivotStandings";

const W1 = { id: "w1", name: "WOD 1", created_at: "2026-01-01T00:00:00Z" };
const W2 = { id: "w2", name: "WOD 2", created_at: "2026-01-02T00:00:00Z" };
const athlete = (id: string, first: string, last: string) => ({
  athlete_id: id,
  team_id: null,
  athletes: { first_name: first, last_name: last },
  teams: null,
});
const row = (o: Partial<RawStandingRow> & Pick<RawStandingRow, "athlete_id">): RawStandingRow => ({
  wod_id: null,
  placement: null,
  points: null,
  team_id: null,
  athletes: null,
  teams: null,
  wods: null,
  ...o,
});

describe("pivotStandings", () => {
  it("is empty for no rows", () => expect(pivotStandings([])).toEqual({ wods: [], rows: [] }));

  it("orders overall rows by placement, nulls last, and attaches WOD placings", () => {
    const out = pivotStandings([
      row({ ...athlete("a", "Maria", "Rivera"), placement: 2, points: 4 }),
      row({ ...athlete("b", "Sofia", "Delgado"), placement: 1, points: 3 }),
      row({ ...athlete("c", "Camila", "Ortiz"), placement: null, points: null }),
      row({ ...athlete("a", "Maria", "Rivera"), wod_id: "w2", placement: 1, wods: W2 }),
      row({ ...athlete("a", "Maria", "Rivera"), wod_id: "w1", placement: 3, wods: W1 }),
      row({ ...athlete("b", "Sofia", "Delgado"), wod_id: "w1", placement: 1, wods: W1 }),
    ]);
    expect(out.wods).toEqual([
      { id: "w1", name: "WOD 1" },
      { id: "w2", name: "WOD 2" },
    ]);
    expect(out.rows.map((r) => r.name)).toEqual(["Sofia Delgado", "Maria Rivera", "Camila Ortiz"]);
    expect(out.rows[1]).toEqual({
      key: "a",
      placement: 2,
      points: 4,
      name: "Maria Rivera",
      wodPlacements: { w1: 3, w2: 1 },
    });
    expect(out.rows[0].wodPlacements).toEqual({ w1: 1 });
  });

  it("keys teams by team id", () => {
    const team = {
      athlete_id: null,
      team_id: "t1",
      athletes: null,
      teams: { name: "Box 787 Pair" },
    };
    const out = pivotStandings([
      row({ ...team, placement: 1, points: 1 }),
      row({ ...team, wod_id: "w1", placement: 1, wods: W1 }),
    ]);
    expect(out.rows).toEqual([
      { key: "t1", placement: 1, points: 1, name: "Box 787 Pair", wodPlacements: { w1: 1 } },
    ]);
  });

  it("leaves out a competitor with WOD rows but no overall row", () => {
    const out = pivotStandings([
      row({ ...athlete("z", "Zoe", "Zayas"), wod_id: "w1", placement: 4, wods: W1 }),
    ]);
    expect(out.rows).toEqual([]);
    expect(out.wods).toEqual([{ id: "w1", name: "WOD 1" }]);
  });
});

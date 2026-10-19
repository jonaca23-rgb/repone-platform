import { describe, expect, it } from "vitest";
import { groupCompetitionHistory } from "./competitionHistory";

const lookups = {
  events: [
    { id: "e1", name: "Throwdown", starts_on: "2026-03-01" },
    { id: "e2", name: "Finale", starts_on: "2026-05-01" },
  ],
  divisions: [
    { id: "d-ind", name: "Rx Female" },
    { id: "d-pairs", name: "Pairs" },
  ],
  wods: [
    { id: "w1", name: "WOD 1", sort_order: 0 },
    { id: "w2", name: "WOD 2", sort_order: 1 },
  ],
};
const row = (
  id: string,
  event: string,
  division: string,
  wod: string | null,
  placement: number,
  team: string | null = null,
) => ({
  id,
  event_id: event,
  division_id: division,
  wod_id: wod,
  team_id: team,
  placement,
  points: placement,
  teams: team ? { name: "Aprieta Duo" } : null,
});

describe("groupCompetitionHistory", () => {
  it("shows a team's results beside the athlete's own, named for the team", () => {
    const groups = groupCompetitionHistory(
      [
        row("s1", "e1", "d-ind", null, 4),
        row("s2", "e1", "d-ind", "w1", 4),
        row("s3", "e1", "d-pairs", null, 2, "t1"),
        row("s4", "e1", "d-pairs", "w2", 1, "t1"),
        row("s5", "e1", "d-pairs", "w1", 3, "t1"),
        row("s6", "e2", "d-ind", null, 7),
      ],
      lookups,
    );
    expect(groups.map((g) => [g.key, g.eventName, g.divisionName, g.overall?.placement])).toEqual([
      ["e2:own", "Finale", "Rx Female", 7],
      ["e1:own", "Throwdown", "Rx Female", 4],
      ["e1:t1", "Throwdown", "Pairs · Team Aprieta Duo", 2],
    ]);
    expect(groups[2].wods.map((w) => w.name)).toEqual(["WOD 1", "WOD 2"]);
  });

  it("drops a row whose event it can't see", () => {
    expect(groupCompetitionHistory([row("s1", "gone", "d-ind", null, 1)], lookups)).toEqual([]);
  });
});

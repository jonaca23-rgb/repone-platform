import { describe, expect, it } from "vitest";
import { laneCompetitor, type RawLane, toFloorLanes } from "./floorLanes";

const athleteLane: RawLane = {
  lane_number: 2,
  athlete_id: "a-1",
  team_id: null,
  athletes: { first_name: "Maria", last_name: "Rivera", affiliate: "CrossFit Aprieta" },
  teams: null,
};
const teamLane: RawLane = {
  lane_number: 1,
  athlete_id: null,
  team_id: "t-1",
  athletes: null,
  teams: {
    name: "Aprieta Duo",
    affiliate: "CrossFit Aprieta",
    team_members: [
      { athletes: { first_name: "Isabella", last_name: "Vega" } },
      { athletes: { first_name: "Gabriela", last_name: "Torres" } },
    ],
  },
};
const emptyLane: RawLane = {
  lane_number: 3,
  athlete_id: null,
  team_id: null,
  athletes: null,
  teams: null,
};

describe("toFloorLanes", () => {
  it("describes each occupant, in lane order", () => {
    expect(toFloorLanes([emptyLane, athleteLane, teamLane])).toEqual([
      {
        laneNumber: 1,
        athleteId: null,
        teamId: "t-1",
        name: "Aprieta Duo",
        affiliate: "CrossFit Aprieta",
        members: ["Gabriela Torres", "Isabella Vega"],
      },
      {
        laneNumber: 2,
        athleteId: "a-1",
        teamId: null,
        name: "Maria Rivera",
        affiliate: "CrossFit Aprieta",
        members: [],
      },
      { laneNumber: 3, athleteId: null, teamId: null, name: null, affiliate: null, members: [] },
    ]);
  });

  it("is empty for no lanes", () => expect(toFloorLanes(null)).toEqual([]));
});

describe("laneCompetitor", () => {
  it("names an athlete, a team, or nobody", () => {
    expect(laneCompetitor({ athleteId: "a-1", teamId: null })).toEqual({
      type: "athlete",
      id: "a-1",
    });
    expect(laneCompetitor({ athleteId: null, teamId: "t-1" })).toEqual({ type: "team", id: "t-1" });
    expect(laneCompetitor({ athleteId: null, teamId: null })).toBeNull();
  });
});

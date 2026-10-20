import { describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/lib/actions/testing/fakeSupabase";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.current }));

import { getAthleteCompetitionHistory } from "./messages";

const embeds = {
  events: { id: "e1", name: "Throwdown", starts_on: "2026-03-01" },
  wods: null,
};

describe("getAthleteCompetitionHistory", () => {
  it("reads the athlete's own and their teams' standings in two parallel queries", async () => {
    const fake = fakeSupabase({
      standings: [
        {
          data: [
            {
              id: "s1",
              event_id: "e1",
              division_id: "d1",
              wod_id: null,
              team_id: null,
              placement: 4,
              points: 4,
              teams: null,
              divisions: { id: "d1", name: "Rx Female" },
              ...embeds,
            },
          ],
        },
        {
          data: [
            {
              id: "s2",
              event_id: "e1",
              division_id: "d2",
              wod_id: null,
              team_id: "t1",
              placement: 2,
              points: 2,
              teams: { name: "Aprieta Duo" },
              divisions: { id: "d2", name: "Pairs" },
              ...embeds,
            },
          ],
        },
      ],
    });
    db.current = fake.client;
    const history = await getAthleteCompetitionHistory("a1");
    expect(history.map((h) => [h.eventName, h.divisionName, h.overall?.placement])).toEqual([
      ["Throwdown", "Rx Female", 4],
      ["Throwdown", "Pairs · Team Aprieta Duo", 2],
    ]);
    expect(fake.calls.map(([table]) => table).filter((t, i, all) => all.indexOf(t) === i)).toEqual([
      "standings",
    ]);
    expect(fake.calls).toContainEqual(["standings", "eq", ["athlete_id", "a1"]]);
    expect(fake.calls).toContainEqual([
      "standings",
      "eq",
      ["member_of.team_members.athlete_id", "a1"],
    ]);
  });
});

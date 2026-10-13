import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./testing/fakeSupabase";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.current }));
vi.mock("@/lib/auth/guards", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/guards")>()),
  requireEventAccess: async () => ({
    ctx: { userId: "u-1" },
    eventId: "ev-1",
    organizationId: "org-1",
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  addTeamMember,
  createTeam,
  deleteTeam,
  removeTeamMember,
  setTeamCaptain,
  updateTeam,
} from "./teams";

const EVENT = "00000000-0000-4000-8000-000000000010";
const DIVISION = "00000000-0000-4000-8000-000000000041";
const TEAM = "00000000-0000-4000-8000-0000000000a1";
const ATHLETE = "00000000-0000-4000-8000-000000000066";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}
const dbError = (message: string) => ({ error: { message } });
const newTeam = () =>
  form({ name: "Aprieta Duo", division_id: DIVISION, affiliate: "CrossFit Aprieta" });

beforeEach(() => vi.clearAllMocks());

describe("createTeam", () => {
  it("creates the team; the database registers it in the same step", async () => {
    const fake = fakeSupabase({ teams: [{ error: null }] });
    db.current = fake.client;
    expect(await createTeam(EVENT, newTeam())).toEqual({ ok: true });
    expect(fake.calls).toContainEqual([
      "teams",
      "insert",
      [
        {
          event_id: EVENT,
          division_id: DIVISION,
          name: "Aprieta Duo",
          affiliate: "CrossFit Aprieta",
        },
      ],
    ]);
    expect(fake.calls.some(([t]) => t === "registrations")).toBe(false);
  });

  it("refuses an individual division on its field", async () => {
    db.current = fakeSupabase({
      teams: [dbError("team_division_individual: that division is for individuals")],
    }).client;
    const message = "That division is for individuals. Choose a team division.";
    expect(await createTeam(EVENT, newTeam())).toEqual({
      ok: false,
      message,
      fieldErrors: { division_id: [message] },
    });
  });

  it("refuses a name another team in the event has", async () => {
    db.current = fakeSupabase({
      teams: [dbError('duplicate key value violates unique constraint "teams_event_name_key"')],
    }).client;
    const message = "A team with that name already exists in this event.";
    expect(await createTeam(EVENT, newTeam())).toEqual({
      ok: false,
      message,
      fieldErrors: { name: [message] },
    });
  });
});

describe("updateTeam", () => {
  it("renames a team of this event", async () => {
    const fake = fakeSupabase({ teams: [{ data: [{ id: TEAM }] }] });
    db.current = fake.client;
    expect(await updateTeam(EVENT, TEAM, form({ name: "Duo 2" }))).toEqual({ ok: true });
    expect(fake.calls).toContainEqual(["teams", "eq", ["event_id", EVENT]]);
  });
});

describe("deleteTeam", () => {
  it("refuses a team that has results", async () => {
    const fake = fakeSupabase({ results: [{ data: [{ id: "r-1" }] }] });
    db.current = fake.client;
    expect(await deleteTeam(EVENT, TEAM)).toEqual({
      ok: false,
      message: "This team has results and can't be deleted. Remove its results first.",
    });
    expect(fake.calls.some(([t, m]) => t === "teams" && m === "delete")).toBe(false);
  });

  it("deletes a team with no results", async () => {
    db.current = fakeSupabase({
      results: [{ data: [] }],
      teams: [{ data: [{ id: TEAM }] }],
    }).client;
    expect(await deleteTeam(EVENT, TEAM)).toEqual({ ok: true });
  });
});

describe("addTeamMember", () => {
  const add = () => addTeamMember(EVENT, TEAM, form({ athlete_id: ATHLETE }));
  const team = { data: { id: TEAM, divisions: { team_size: 2 } } };

  it("adds an athlete to a team of this event", async () => {
    const fake = fakeSupabase({ teams: [team], team_members: [{ error: null }] });
    db.current = fake.client;
    expect(await add()).toEqual({ ok: true });
    expect(fake.calls).toContainEqual([
      "team_members",
      "insert",
      [{ team_id: TEAM, athlete_id: ATHLETE, event_id: EVENT }],
    ]);
  });

  it("refuses a team of another event", async () => {
    db.current = fakeSupabase({ teams: [{ data: null }] }).client;
    expect(await add()).toEqual({ ok: false, message: "That team isn't part of this event." });
  });

  it.each([
    ["team_member_other_team: …", "That athlete is already on another team in this event."],
    [
      'duplicate key value violates unique constraint "team_members_event_athlete_key"',
      "That athlete is already on another team in this event.",
    ],
    [
      "team_full: this team already has 2 of 2 members",
      "This team is full: its division takes 2 per team.",
    ],
    ["team_member_org: …", "That athlete isn't part of this organization."],
    [
      'duplicate key value violates unique constraint "team_members_team_id_athlete_id_key"',
      "That athlete is already on this team.",
    ],
  ])("explains %s", async (dbMessage, message) => {
    db.current = fakeSupabase({ teams: [team], team_members: [dbError(dbMessage)] }).client;
    expect(await add()).toMatchObject({ ok: false, message });
  });
});

describe("removeTeamMember", () => {
  it("removes a member of this event's team", async () => {
    const fake = fakeSupabase({ team_members: [{ data: [{ id: "m-1" }] }] });
    db.current = fake.client;
    expect(await removeTeamMember(EVENT, TEAM, "m-1")).toEqual({ ok: true });
    expect(fake.calls).toContainEqual(["team_members", "eq", ["event_id", EVENT]]);
    expect(fake.calls).toContainEqual(["team_members", "eq", ["team_id", TEAM]]);
  });
});

describe("setTeamCaptain", () => {
  it("refuses an athlete who isn't on the roster", async () => {
    db.current = fakeSupabase({
      teams: [dbError("team_captain_not_member: the captain must be on the roster")],
    }).client;
    expect(await setTeamCaptain(EVENT, TEAM, ATHLETE)).toEqual({
      ok: false,
      message: "Only a member of the team can be its captain.",
    });
  });

  it("sets and clears the captain", async () => {
    const fake = fakeSupabase({ teams: [{ data: [{ id: TEAM }] }, { data: [{ id: TEAM }] }] });
    db.current = fake.client;
    expect(await setTeamCaptain(EVENT, TEAM, ATHLETE)).toEqual({ ok: true });
    expect(await setTeamCaptain(EVENT, TEAM, null)).toEqual({ ok: true });
    expect(fake.calls).toContainEqual(["teams", "update", [{ captain_athlete_id: null }]]);
  });
});

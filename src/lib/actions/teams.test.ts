import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./testing/fakeSupabase";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.current }));
vi.mock("@/lib/auth/guards", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/guards")>()),
  requireOrgManager: async () => ({ organizationId: "org-1" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { addTeamMember, createTeam, deleteTeam, removeTeamMember } from "./teams";

const ATHLETE = "00000000-0000-4000-8000-000000000066";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

beforeEach(() => vi.clearAllMocks());

describe("createTeam", () => {
  it("puts a fractional headcount on its field", async () => {
    db.current = fakeSupabase({}).client;
    expect(await createTeam(form({ name: "Box 787", team_size: "2.5" }))).toEqual({
      ok: false,
      message: "Headcount must be a whole number.",
      fieldErrors: { team_size: ["Headcount must be a whole number."] },
    });
  });

  it("adds a team", async () => {
    db.current = fakeSupabase({ teams: [{ error: null }] }).client;
    expect(await createTeam(form({ name: "Box 787" }))).toEqual({ ok: true });
  });
});

describe("addTeamMember", () => {
  it("says the athlete is already on the roster", async () => {
    db.current = fakeSupabase({
      teams: [{ data: { id: "t-1" } }],
      athletes: [{ data: { id: ATHLETE } }],
      team_members: [{ error: { message: "team_members_team_id_athlete_id_key" } }],
    }).client;
    expect(await addTeamMember("t-1", form({ athlete_id: ATHLETE }))).toEqual({
      ok: false,
      message: "That athlete is already on this team's roster.",
    });
  });
});

describe("removeTeamMember", () => {
  it("says when the roster entry is gone", async () => {
    db.current = fakeSupabase({ team_members: [{ data: null }] }).client;
    expect(await removeTeamMember("tm-1")).toEqual({
      ok: false,
      message: "That roster entry doesn't exist.",
    });
  });
});

describe("deleteTeam", () => {
  it("deletes a team", async () => {
    db.current = fakeSupabase({ teams: [{ data: [{ id: "t-1" }] }] }).client;
    expect(await deleteTeam("t-1")).toEqual({ ok: true });
  });
});

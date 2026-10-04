import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./testing/fakeSupabase";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.current }));
vi.mock("@/lib/auth/guards", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/guards")>()),
  requireEventAccess: async () => ({ organizationId: "org-1" }),
}));
const jar = vi.hoisted(() => ({ set: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => jar }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { registerAthlete, registerTeam, removeRegistration } from "./registrations";

const DIVISION = "00000000-0000-4000-8000-000000000040";
const ATHLETE = "00000000-0000-4000-8000-000000000066";
const TEAM = "00000000-0000-4000-8000-000000000077";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

beforeEach(() => vi.clearAllMocks());

describe("registerAthlete", () => {
  it("says the athlete is already in that division", async () => {
    db.current = fakeSupabase({
      divisions: [{ data: { id: DIVISION } }],
      athletes: [{ data: { id: ATHLETE } }],
      registrations: [{ data: { id: "r-1" } }],
    }).client;
    expect(
      await registerAthlete("ev-1", form({ division_id: DIVISION, athlete_id: ATHLETE })),
    ).toEqual({
      ok: false,
      message: "This athlete is already registered in this division/category.",
    });
  });

  it("refuses another event's division on its field", async () => {
    db.current = fakeSupabase({ divisions: [{ data: null }] }).client;
    expect(
      await registerAthlete("ev-1", form({ division_id: DIVISION, athlete_id: ATHLETE })),
    ).toEqual({
      ok: false,
      message: "That division isn't part of this event.",
      fieldErrors: { division_id: ["Choose one of this event's divisions."] },
    });
  });

  it("registers and remembers the division for the next one", async () => {
    db.current = fakeSupabase({
      divisions: [{ data: { id: DIVISION } }],
      athletes: [{ data: { id: ATHLETE } }],
      registrations: [{ data: null }, { error: null }],
    }).client;
    expect(
      await registerAthlete("ev-1", form({ division_id: DIVISION, athlete_id: ATHLETE })),
    ).toEqual({ ok: true });
    expect(jar.set).toHaveBeenCalledWith("repone_last_division_ev-1", DIVISION, expect.anything());
  });
});

describe("registerTeam", () => {
  it("refuses a team from another organization", async () => {
    db.current = fakeSupabase({
      divisions: [{ data: { id: DIVISION } }],
      teams: [{ data: null }],
    }).client;
    expect(await registerTeam("ev-1", form({ division_id: DIVISION, team_id: TEAM }))).toEqual({
      ok: false,
      message: "That team isn't in this event's organization.",
    });
  });
});

describe("removeRegistration", () => {
  it("removes a registration", async () => {
    db.current = fakeSupabase({ registrations: [{ data: [{ id: "r-1" }] }] }).client;
    expect(await removeRegistration("ev-1", "r-1")).toEqual({ ok: true });
  });
});

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

import { registerAthlete, removeRegistration } from "./registrations";

const DIVISION = "00000000-0000-4000-8000-000000000040";
const ATHLETE = "00000000-0000-4000-8000-000000000066";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

beforeEach(() => vi.clearAllMocks());

describe("registerAthlete", () => {
  it("says the athlete is already in that division", async () => {
    db.current = fakeSupabase({
      divisions: [{ data: { id: DIVISION, entry_format: "individual" } }],
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
      divisions: [{ data: { id: DIVISION, entry_format: "individual" } }],
      athletes: [{ data: { id: ATHLETE } }],
      registrations: [{ data: null }, { error: null }],
    }).client;
    expect(
      await registerAthlete("ev-1", form({ division_id: DIVISION, athlete_id: ATHLETE })),
    ).toEqual({ ok: true });
    expect(jar.set).toHaveBeenCalledWith("repone_last_division_ev-1", DIVISION, expect.anything());
  });
});

describe("registerAthlete in a team division", () => {
  it("sends the organizer to the team instead", async () => {
    const fake = fakeSupabase({ divisions: [{ data: { id: DIVISION, entry_format: "pair" } }] });
    db.current = fake.client;
    const message = "That division is for teams. Add the athlete to a team instead.";
    expect(
      await registerAthlete("ev-1", form({ division_id: DIVISION, athlete_id: ATHLETE })),
    ).toEqual({ ok: false, message, fieldErrors: { division_id: [message] } });
    expect(fake.calls.some(([t, m]) => t === "registrations" && m === "insert")).toBe(false);
  });
});

describe("removeRegistration", () => {
  it("leaves a team's registration to the Teams page", async () => {
    const fake = fakeSupabase({ registrations: [{ data: { team_id: "t-1" } }] });
    db.current = fake.client;
    expect(await removeRegistration("ev-1", "r-1")).toEqual({
      ok: false,
      message: "A team's registration goes with the team. Delete the team on the Teams page.",
    });
    expect(fake.calls.some(([t, m]) => t === "registrations" && m === "delete")).toBe(false);
  });

  it("removes a registration", async () => {
    db.current = fakeSupabase({
      registrations: [{ data: { team_id: null } }, { data: [{ id: "r-1" }] }],
    }).client;
    expect(await removeRegistration("ev-1", "r-1")).toEqual({ ok: true });
  });
});

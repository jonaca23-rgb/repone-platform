import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./testing/fakeSupabase";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.current }));
vi.mock("@/lib/auth/guards", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/guards")>()),
  requireSignedIn: async () => ({ userId: "u-1" }),
}));
vi.mock("@/lib/auth/session", () => ({
  getAthleteSessionContext: async () => ({ athleteId: "a-1", organizationId: "o-1" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { createAthleteFromPortal, toggleLike } from "./social";

const ATHLETE = "00000000-0000-4000-8000-000000000061";
const OTHER = "00000000-0000-4000-8000-000000000062";
const LIFT = "00000000-0000-4000-8000-000000000099";

beforeEach(() => vi.clearAllMocks());

describe("social actions", () => {
  it("refuses a like on something that isn't this athlete's", async () => {
    db.current = fakeSupabase({ athlete_lifts: [{ data: { athlete_id: OTHER } }] }).client;
    expect(await toggleLike(ATHLETE, "lift", LIFT)).toEqual({
      ok: false,
      message: "That item doesn't exist, or isn't this athlete's.",
    });
  });

  it("adds an athlete and says where to go", async () => {
    db.current = fakeSupabase({ athletes: [{ data: { id: "new-1" } }] }).client;
    const fd = new FormData();
    fd.set("first_name", "Ana");
    fd.set("last_name", "López");
    fd.set("email", "ana@example.com");
    expect(await createAthleteFromPortal(fd)).toEqual({
      ok: true,
      data: { href: "/athlete/directory/new-1" },
    });
  });
});

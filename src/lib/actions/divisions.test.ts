import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./testing/fakeSupabase";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.current }));
vi.mock("@/lib/auth/guards", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/guards")>()),
  requireEventAccess: async () => ({ organizationId: "org-1" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createDivision, deleteDivision, updateDivision } from "./divisions";
import { addFloor } from "./venues";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

beforeEach(() => vi.clearAllMocks());

describe("divisions", () => {
  it("asks for a division name on its field", async () => {
    db.current = fakeSupabase({}).client;
    expect(await createDivision("ev-1", form({ name: "" }))).toEqual({
      ok: false,
      message: "Division name is required.",
      fieldErrors: { name: ["Division name is required."] },
    });
  });

  it("adds and removes a division", async () => {
    db.current = fakeSupabase({ divisions: [{ error: null }, { data: [{ id: "d-1" }] }] }).client;
    expect(await createDivision("ev-1", form({ name: "Intermediate Female" }))).toEqual({
      ok: true,
    });
    expect(await deleteDivision("ev-1", "d-1")).toEqual({ ok: true });
  });
});

describe("division format", () => {
  const inserted = (fake: ReturnType<typeof fakeSupabase>) =>
    fake.calls.find(([t, m]) => t === "divisions" && m === "insert")?.[2][0];

  it("an individual division stores no team size, whatever is posted", async () => {
    const fake = fakeSupabase({ divisions: [{ error: null }] });
    db.current = fake.client;
    await createDivision("ev-1", form({ name: "RX", entry_format: "individual", team_size: "4" }));
    expect(inserted(fake)).toEqual({
      event_id: "ev-1",
      name: "RX",
      entry_format: "individual",
      team_size: null,
    });
  });

  it("a pair is two per team, whatever is posted", async () => {
    const fake = fakeSupabase({ divisions: [{ error: null }] });
    db.current = fake.client;
    await createDivision("ev-1", form({ name: "Pairs", entry_format: "pair", team_size: "3" }));
    expect(inserted(fake)).toMatchObject({ entry_format: "pair", team_size: 2 });
  });

  it("a team division needs its size", async () => {
    db.current = fakeSupabase({}).client;
    expect(await createDivision("ev-1", form({ name: "Teams", entry_format: "team" }))).toEqual({
      ok: false,
      message: "Athletes per team is required.",
      fieldErrors: { team_size: ["Athletes per team is required."] },
    });
  });

  it("refuses a format change once the division has registrations", async () => {
    const fake = fakeSupabase({
      divisions: [{ data: { entry_format: "individual", team_size: null } }],
      registrations: [{ data: [{ id: "r-1" }] }],
    });
    db.current = fake.client;
    expect(
      await updateDivision(
        "ev-1",
        "d-1",
        form({ name: "RX", entry_format: "team", team_size: "4" }),
      ),
    ).toEqual({
      ok: false,
      message: "This division already has registrations, so its format can't change.",
    });
    expect(fake.calls.some(([t, m]) => t === "divisions" && m === "update")).toBe(false);
  });

  it("explains the database's refusal when someone registered in between", async () => {
    db.current = fakeSupabase({
      divisions: [
        { data: { entry_format: "individual", team_size: null } },
        { error: { message: "division_format_locked: this division already has registrations" } },
      ],
      registrations: [{ data: [] }],
      teams: [{ data: [] }],
    }).client;
    expect(
      await updateDivision(
        "ev-1",
        "d-1",
        form({ name: "RX", entry_format: "team", team_size: "4" }),
      ),
    ).toEqual({
      ok: false,
      message: "This division already has registrations, so its format can't change.",
    });
  });

  it("renames a division with registrations when the format stays", async () => {
    const fake = fakeSupabase({
      divisions: [
        { data: { entry_format: "individual", team_size: null } },
        { data: [{ id: "d-1" }] },
      ],
    });
    db.current = fake.client;
    expect(await updateDivision("ev-1", "d-1", form({ name: "RX Female" }))).toEqual({ ok: true });
  });

  it("changes the format of a division nobody is in yet", async () => {
    db.current = fakeSupabase({
      divisions: [
        { data: { entry_format: "individual", team_size: null } },
        { data: [{ id: "d-1" }] },
      ],
      registrations: [{ data: [] }],
      teams: [{ data: [] }],
    }).client;
    expect(
      await updateDivision(
        "ev-1",
        "d-1",
        form({ name: "RX", entry_format: "team", team_size: "4" }),
      ),
    ).toEqual({ ok: true });
  });
});

describe("addFloor", () => {
  it("refuses a venue from another event", async () => {
    db.current = fakeSupabase({ venues: [{ data: null }] }).client;
    expect(await addFloor("ev-1", "ve-9", form({ name: "Floor B" }))).toEqual({
      ok: false,
      message: "That venue doesn't belong to this event.",
    });
  });

  it("adds a floor with its broadcast state", async () => {
    db.current = fakeSupabase({
      venues: [{ data: { id: "ve-1" } }],
      floors: [{ data: { id: "fl-2" } }],
      broadcast_state: [{ error: null }],
    }).client;
    expect(await addFloor("ev-1", "ve-1", form({ name: "Floor B" }))).toEqual({ ok: true });
  });
});

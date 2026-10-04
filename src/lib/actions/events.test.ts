import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./testing/fakeSupabase";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.current }));
vi.mock("@/lib/auth/guards", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/guards")>()),
  requireOrgManager: async () => ({ organizationId: "org-1" }),
  requireEventAccess: async () => ({ organizationId: "org-1" }),
  requireSignedIn: async () => ({}),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createEvent, deleteEvent, updateEventStatus } from "./events";
import { bootstrapOrganization } from "./org";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

beforeEach(() => vi.clearAllMocks());

describe("createEvent", () => {
  it("asks for the new circuit's name on its field", async () => {
    db.current = fakeSupabase({}).client;
    expect(await createEvent(form({ name: "Open", circuit_choice: "new" }))).toEqual({
      ok: false,
      message: "Circuit name is required when starting a new circuit.",
      fieldErrors: { new_circuit_name: ["Name the new circuit."] },
    });
  });

  it("sends the person to the new event", async () => {
    db.current = fakeSupabase({
      events: [{ data: { id: "ev-9" } }],
      venues: [{ data: { id: "ve-1" } }],
      floors: [{ data: { id: "fl-1" } }],
      broadcast_state: [{ error: null }],
    }).client;
    expect(await createEvent(form({ name: "Open", circuit_choice: "" }))).toEqual({
      ok: true,
      data: { href: "/admin/events/ev-9" },
    });
  });
});

describe("createEvent when its setup half-fails", () => {
  it("still opens the new event and says what is missing, so nobody creates it twice", async () => {
    db.current = fakeSupabase({
      events: [{ data: { id: "ev-9" } }],
      venues: [{ error: { message: "venue insert refused" } }],
    }).client;
    expect(await createEvent(form({ name: "Open", circuit_choice: "" }))).toEqual({
      ok: true,
      data: {
        href: "/admin/events/ev-9",
        warning:
          "Event created, but its default venue wasn't: venue insert refused. Add one from the event's Venues page.",
      },
    });
  });
});

describe("deleteEvent", () => {
  it("sends the person back to the events list", async () => {
    db.current = fakeSupabase({ events: [{ data: [{ id: "ev-9", circuit_id: null }] }] }).client;
    expect(await deleteEvent("ev-9")).toEqual({ ok: true, data: { href: "/admin" } });
  });
});

describe("updateEventStatus", () => {
  it("refuses an unknown status", async () => {
    db.current = fakeSupabase({}).client;
    // @ts-expect-error: a value from the browser need not be a known status.
    expect(await updateEventStatus("ev-9", "party")).toEqual({
      ok: false,
      message: "Choose a valid event status.",
    });
  });
});

describe("bootstrapOrganization", () => {
  it("names the organization", async () => {
    db.current = { rpc: async () => ({ error: null }) };
    expect(await bootstrapOrganization(form({ name: "RepOneLive" }))).toEqual({ ok: true });
  });
});

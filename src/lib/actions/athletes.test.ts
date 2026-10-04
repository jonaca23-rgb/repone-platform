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

import {
  createAthlete,
  deleteAthlete,
  deleteAthleteBenchmark,
  removeAthletePhoto,
  saveAthleteLifts,
  updateAthleteProfile,
  uploadAthletePhoto,
  upsertAthleteBenchmark,
} from "./athletes";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

const MARIA = { first_name: "Maria", last_name: "Rivera", email: "maria@example.com" };

beforeEach(() => vi.clearAllMocks());

describe("createAthlete", () => {
  it("puts a duplicate email on the email field", async () => {
    db.current = fakeSupabase({
      athletes: [
        {
          error: {
            code: "23505",
            message: 'duplicate key value violates unique constraint "athletes_org_email_unique"',
          },
        },
      ],
    }).client;
    expect(await createAthlete(form(MARIA))).toEqual({
      ok: false,
      message: "An athlete with this email already exists in your organization.",
      fieldErrors: { email: ["Already used by another athlete."] },
    });
  });

  it("puts a duplicate phone on the phone field", async () => {
    db.current = fakeSupabase({
      athletes: [
        {
          error: {
            code: "23505",
            message: 'duplicate key value violates unique constraint "athletes_org_phone_unique"',
          },
        },
      ],
    }).client;
    expect(await createAthlete(form({ ...MARIA, phone: "787-555-0101" }))).toEqual({
      ok: false,
      message: "An athlete with this phone number already exists in your organization.",
      fieldErrors: { phone: ["Already used by another athlete."] },
    });
  });

  it("adds an athlete", async () => {
    db.current = fakeSupabase({ athletes: [{ error: null }] }).client;
    expect(await createAthlete(form(MARIA))).toEqual({ ok: true });
  });
});

describe("deleteAthlete", () => {
  it("removes an athlete", async () => {
    db.current = fakeSupabase({ athletes: [{ data: [{ id: "a-1" }] }] }).client;
    expect(await deleteAthlete("a-1")).toEqual({ ok: true });
  });
});

describe("the athlete page's actions", () => {
  it("puts a bad run time on its own field", async () => {
    db.current = fakeSupabase({}).client;
    expect(await saveAthleteLifts("a-1", form({ run_400m: "fast" }))).toEqual({
      ok: false,
      message: "400m Run must be a time like mm:ss.",
      fieldErrors: { run_400m: ["400m Run must be a time like mm:ss."] },
    });
  });

  it("saves lifts, and does nothing when every field is blank", async () => {
    db.current = fakeSupabase({
      athletes: [{ data: { id: "a-1" } }],
      athlete_lifts: [{ error: null }],
    }).client;
    expect(await saveAthleteLifts("a-1", form({ deadlift: "315" }))).toEqual({ ok: true });
    expect(await saveAthleteLifts("a-1", form({}))).toEqual({ ok: true });
  });

  it("refuses an athlete from another roster", async () => {
    db.current = fakeSupabase({ athletes: [{ data: null }] }).client;
    expect(
      await upsertAthleteBenchmark("a-9", form({ name: "Fran", result_display: "3:45" })),
    ).toEqual({ ok: false, message: "That athlete isn't on your organization's roster." });
  });

  it("removes a benchmark", async () => {
    db.current = fakeSupabase({
      athletes: [{ data: { id: "a-1" } }],
      athlete_benchmarks: [{ data: [{ id: "b-1" }] }],
    }).client;
    expect(await deleteAthleteBenchmark("a-1", "b-1")).toEqual({ ok: true });
  });

  it("puts a duplicate email on the profile's email field", async () => {
    db.current = fakeSupabase({
      athletes: [{ error: { code: "23505", message: "athletes_org_email_unique" } }],
    }).client;
    expect(await updateAthleteProfile("a-1", form(MARIA))).toEqual({
      ok: false,
      message: "An athlete with this email already exists in your organization.",
      fieldErrors: { email: ["Already used by another athlete."] },
    });
  });

  it("asks for a photo on the photo field", async () => {
    db.current = fakeSupabase({}).client;
    expect(await uploadAthletePhoto("a-1", form({}))).toEqual({
      ok: false,
      message: "Choose an image file to upload.",
      fieldErrors: { photo: ["Choose an image file to upload."] },
    });
  });

  it("removes the photo", async () => {
    db.current = fakeSupabase({ athletes: [{ data: [{ id: "a-1" }] }] }).client;
    expect(await removeAthletePhoto("a-1")).toEqual({ ok: true });
  });
});

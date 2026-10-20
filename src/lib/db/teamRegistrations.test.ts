import { describe, expect, it } from "vitest";
import { fakeSupabase } from "@/lib/actions/testing/fakeSupabase";
import { teamRegistrationsFor } from "./teamRegistrations";

type Client = Parameters<typeof teamRegistrationsFor>[0];

describe("teamRegistrationsFor", () => {
  it("reads the registrations of the athlete's teams in one query", async () => {
    const fake = fakeSupabase({ registrations: [{ data: [{ id: "r1" }, { id: "r2" }] }] });
    const rows = await teamRegistrationsFor(fake.client as unknown as Client, "a1", "id");
    expect(rows).toEqual([{ id: "r1" }, { id: "r2" }]);
    expect(fake.calls).toContainEqual([
      "registrations",
      "select",
      ["id, member_of:teams!inner(team_members!inner(athlete_id))"],
    ]);
    expect(fake.calls).toContainEqual([
      "registrations",
      "eq",
      ["member_of.team_members.athlete_id", "a1"],
    ]);
    expect(fake.calls.some(([t]) => t === "team_members")).toBe(false);
  });

  it("fails loudly instead of reading as no teams", async () => {
    const fake = fakeSupabase({ registrations: [{ error: { message: "boom" } }] });
    await expect(
      teamRegistrationsFor(fake.client as unknown as Client, "a1", "id"),
    ).rejects.toThrow("boom");
  });
});

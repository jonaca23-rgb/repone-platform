import { describe, expect, it } from "vitest";
import { fakeSupabase } from "@/lib/actions/testing/fakeSupabase";
import { teamRegistrationsFor } from "./teamRegistrations";

type Client = Parameters<typeof teamRegistrationsFor>[0];

describe("teamRegistrationsFor", () => {
  it("reads the registrations of every team the athlete is on", async () => {
    const fake = fakeSupabase({
      team_members: [{ data: [{ team_id: "t1" }, { team_id: "t2" }] }],
      registrations: [{ data: [{ id: "r1" }, { id: "r2" }] }],
    });
    const rows = await teamRegistrationsFor(fake.client as unknown as Client, "a1", "id");
    expect(rows).toEqual([{ id: "r1" }, { id: "r2" }]);
    expect(fake.calls).toContainEqual(["team_members", "eq", ["athlete_id", "a1"]]);
    expect(fake.calls).toContainEqual(["registrations", "in", ["team_id", ["t1", "t2"]]]);
  });

  it("asks for no registrations when the athlete is on no team", async () => {
    const fake = fakeSupabase({ team_members: [{ data: [] }] });
    expect(await teamRegistrationsFor(fake.client as unknown as Client, "a1", "id")).toEqual([]);
    expect(fake.calls.some(([t]) => t === "registrations")).toBe(false);
  });

  it("fails loudly instead of reading as no teams", async () => {
    const fake = fakeSupabase({ team_members: [{ error: { message: "boom" } }] });
    await expect(
      teamRegistrationsFor(fake.client as unknown as Client, "a1", "id"),
    ).rejects.toThrow("boom");
  });
});

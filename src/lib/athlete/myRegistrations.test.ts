import { describe, expect, it } from "vitest";
import { chooseCurrentRegistration, registrationLabel } from "./myRegistrations";

describe("registrationLabel", () => {
  it("names the division, and the team when it is a team's registration", () => {
    expect(registrationLabel({ divisions: { name: "Intermediate Female" }, teams: null })).toBe(
      "Intermediate Female",
    );
    expect(
      registrationLabel({ divisions: { name: "Pairs" }, teams: { name: "Aprieta Duo" } }),
    ).toBe("Pairs · Team Aprieta Duo");
    expect(registrationLabel({ divisions: null, teams: null })).toBe("—");
  });
});

describe("chooseCurrentRegistration", () => {
  const reg = (id: string, status: string, startsOn: string | null) => ({
    id,
    events: { status, starts_on: startsOn },
  });

  it("prefers a live event, then the most recently started one", () => {
    expect(
      chooseCurrentRegistration([
        reg("old", "completed", "2026-01-01"),
        reg("team-live", "live", "2026-03-01"),
        reg("new", "published", "2026-05-01"),
      ])?.id,
    ).toBe("team-live");
    expect(
      chooseCurrentRegistration([
        reg("old", "completed", "2026-01-01"),
        reg("new", "published", "2026-05-01"),
      ])?.id,
    ).toBe("new");
  });

  it("shows the athlete's own standing over their team's in the same live event", () => {
    const event = { status: "live", starts_on: "2026-03-01" };
    expect(
      chooseCurrentRegistration([
        { id: "team", events: event, teams: { name: "Aprieta Duo" } },
        { id: "own", events: event, teams: null },
      ])?.id,
    ).toBe("own");
  });

  it("is null with no registrations", () => expect(chooseCurrentRegistration([])).toBeNull());
});

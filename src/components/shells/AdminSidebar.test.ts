import { describe, expect, it } from "vitest";
import { activeHref, eventIdFromPath } from "./AdminSidebar";

const EV = "00000000-0000-0000-0000-000000000010";

describe("activeHref", () => {
  it.each([
    ["/admin", null, "/admin"],
    ["/admin/athletes", null, "/admin/athletes"],
    ["/admin/athletes/abc", null, "/admin/athletes"],
    ["/admin/checkin/abc", null, "/admin/checkin"],
    ["/admin/messages/xyz", null, "/admin/messages"],
    ["/admin/team", null, "/admin/team"],
    ["/admin/teams", null, "/admin/teams"],
    [`/admin/events/${EV}`, EV, `/admin/events/${EV}`],
    [`/admin/events/${EV}/athletes`, EV, `/admin/events/${EV}/athletes`],
    [`/admin/events/${EV}/heats/h1`, EV, `/admin/events/${EV}/heats`],
    [`/admin/events/${EV}/unknown`, EV, "/admin"],
  ])("%s marks %s", (path, eventId, expected) => {
    expect(activeHref(path, eventId)).toBe(expected);
  });

  it("marks nothing outside the admin area", () => {
    expect(activeHref("/producer", null)).toBeNull();
  });
});

describe("eventIdFromPath", () => {
  it("reads the event id from an event route only", () => {
    expect(eventIdFromPath(`/admin/events/${EV}/heats`)).toBe(EV);
    expect(eventIdFromPath("/admin/athletes")).toBeNull();
  });
});

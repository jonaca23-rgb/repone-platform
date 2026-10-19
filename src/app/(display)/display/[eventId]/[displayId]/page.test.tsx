import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);
vi.mock("next/navigation", () => ({ notFound }));
const loadDisplaySnapshot = vi.hoisted(() => vi.fn(async () => null));
vi.mock("@/lib/display/snapshot", () => ({ loadDisplaySnapshot }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({}) }));

import VenueDisplayPage from "./page";

const EVENT = "00000000-0000-4000-8000-000000000010";

beforeEach(() => vi.clearAllMocks());

describe("VenueDisplayPage", () => {
  it.each([
    ["a display", { eventId: EVENT, displayId: "not-a-display" }],
    ["an event", { eventId: "nope", displayId: EVENT }],
  ])("is a 404 for %s id that isn't a UUID, without asking the database", async (_, ids) => {
    await expect(VenueDisplayPage({ params: Promise.resolve(ids) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(loadDisplaySnapshot).not.toHaveBeenCalled();
  });
});

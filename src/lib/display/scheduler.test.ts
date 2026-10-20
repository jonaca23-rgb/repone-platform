import { describe, expect, it } from "vitest";
import {
  INITIAL_SCHEDULER_STATE,
  nextItem,
  type InfoSlot,
  type PlaylistItem,
  type SponsorSlot,
} from "./scheduler";

const sponsor = (id: string, weight: number, durationSeconds = 10): SponsorSlot => ({
  sponsorshipId: `ss-${id}`,
  sponsorId: id,
  weight,
  durationSeconds,
});
const info = (type: InfoSlot["type"], weight = 1): InfoSlot => ({
  type,
  weight,
  durationSeconds: 15,
});

function run(input: Parameters<typeof nextItem>[0], n: number) {
  let state = INITIAL_SCHEDULER_STATE;
  const items: PlaylistItem[] = [];
  for (let i = 0; i < n; i++) {
    const r = nextItem(input, state);
    if (r.item) items.push(r.item);
    state = r.state;
  }
  return items;
}
const sponsorIds = (items: PlaylistItem[]) =>
  items.flatMap((i) => (i.kind === "sponsor" ? [i.slot.sponsorId] : []));

describe("nextItem — weights", () => {
  const input = {
    sponsors: [sponsor("A", 1), sponsor("B", 1), sponsor("C", 2), sponsor("D", 4)],
    info: [info("current_heat"), info("leaderboard")],
    infoBetweenSponsors: 1,
  };

  it("delivers inventory in proportion to weight (1:1:2:4)", () => {
    const ids = sponsorIds(run(input, 160)); // 80 sponsor slots
    const count = (id: string) => ids.filter((x) => x === id).length;
    expect([count("A"), count("B"), count("C"), count("D")]).toEqual([10, 10, 20, 40]);
  });

  it("a premium sponsor never waits more than 2 sponsor slots", () => {
    const ids = sponsorIds(run(input, 160));
    let gap = 0;
    for (const id of ids) {
      gap = id === "D" ? 0 : gap + 1;
      expect(gap).toBeLessThanOrEqual(2);
    }
  });

  it("alternates sponsor and info when infoBetweenSponsors is 1", () => {
    const kinds = run(input, 10).map((i) => i.kind);
    expect(kinds).toEqual([
      "sponsor",
      "info",
      "sponsor",
      "info",
      "sponsor",
      "info",
      "sponsor",
      "info",
      "sponsor",
      "info",
    ]);
  });

  it("plays two info blocks between sponsors when asked", () => {
    const kinds = run({ ...input, infoBetweenSponsors: 2 }, 6).map((i) => i.kind);
    expect(kinds).toEqual(["sponsor", "info", "info", "sponsor", "info", "info"]);
  });
});

describe("nextItem — degenerate inputs", () => {
  it("returns null when nothing is eligible", () => {
    expect(
      nextItem({ sponsors: [], info: [], infoBetweenSponsors: 1 }, INITIAL_SCHEDULER_STATE).item,
    ).toBeNull();
  });
  it("plays only info when there are no sponsors", () => {
    const items = run(
      { sponsors: [], info: [info("current_heat"), info("next_heat")], infoBetweenSponsors: 1 },
      4,
    );
    expect(items.every((i) => i.kind === "info")).toBe(true);
    expect(items.map((i) => i.slot)).toHaveLength(4);
  });
  it("never shows the same advertiser twice in a row when only sponsors are eligible", () => {
    const ids = sponsorIds(
      run({ sponsors: [sponsor("A", 1), sponsor("D", 4)], info: [], infoBetweenSponsors: 1 }, 20),
    );
    for (let i = 1; i < ids.length; i++) expect(ids[i]).not.toBe(ids[i - 1]);
  });
  it("repeats a single sponsor when it is the only thing to show", () => {
    const ids = sponsorIds(
      run({ sponsors: [sponsor("A", 3)], info: [], infoBetweenSponsors: 1 }, 3),
    );
    expect(ids).toEqual(["A", "A", "A"]);
  });
});

describe("nextItem — schedule changes mid-rotation", () => {
  it("drops a removed sponsor immediately and forgets its credit", () => {
    const full = { sponsors: [sponsor("A", 1), sponsor("B", 4)], info: [], infoBetweenSponsors: 1 };
    let state = INITIAL_SCHEDULER_STATE;
    for (let i = 0; i < 3; i++) state = nextItem(full, state).state;
    const withoutB = { ...full, sponsors: [sponsor("A", 1)] };
    const r = nextItem(withoutB, state);
    expect(r.item).toMatchObject({ kind: "sponsor", slot: { sponsorId: "A" } });
    expect(Object.keys(r.state.sponsorCredit)).toEqual(["ss-A"]);
  });
  it("an info block that stops being eligible is skipped on the next pick", () => {
    let state = INITIAL_SCHEDULER_STATE;
    state = nextItem(
      { sponsors: [], info: [info("current_heat"), info("leaderboard")], infoBetweenSponsors: 1 },
      state,
    ).state;
    const r = nextItem(
      { sponsors: [], info: [info("leaderboard")], infoBetweenSponsors: 1 },
      state,
    );
    expect(r.item).toMatchObject({ kind: "info", slot: { type: "leaderboard" } });
  });
});

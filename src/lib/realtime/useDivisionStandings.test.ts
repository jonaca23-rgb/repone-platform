// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Pending = { resolve: (rows: unknown[]) => void };
const fake = vi.hoisted(() => ({
  fetches: [] as Pending[],
  onChange: null as null | (() => void),
}));
vi.mock("@/lib/db/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () =>
          new Promise((resolve) => {
            fake.fetches.push({ resolve: (rows) => resolve({ data: rows }) });
          }),
      }),
    }),
    channel: () => {
      const ch = {
        on: (_e: string, _f: unknown, cb: () => void) => {
          fake.onChange = cb;
          return ch;
        },
        subscribe: () => ch,
      };
      return ch;
    },
    removeChannel: () => {},
  }),
}));

import { useDivisionStandings } from "./useDivisionStandings";

const overall = (placement: number, points: number) => [
  {
    wod_id: null,
    placement,
    points,
    athlete_id: "a",
    team_id: null,
    athletes: { first_name: "Maria", last_name: "Rivera" },
    teams: null,
    wods: null,
  },
];

beforeEach(() => {
  vi.useFakeTimers();
  fake.fetches = [];
  fake.onChange = null;
});
afterEach(() => vi.useRealTimers());

describe("useDivisionStandings", () => {
  it("refetches once for a burst of changes and keeps only the newest answer", async () => {
    const { result } = renderHook(() => useDivisionStandings("d1"));
    await act(async () => fake.fetches[0].resolve(overall(1, 1)));
    expect(result.current.rows[0].points).toBe(1);

    // A save rewrites many rows: many change events in a burst.
    act(() => {
      for (let i = 0; i < 20; i++) fake.onChange?.();
    });
    await act(async () => vi.advanceTimersByTime(300));
    expect(fake.fetches.length).toBe(2);

    // A second burst; its fetch answers first, then the older one answers late.
    act(() => fake.onChange?.());
    await act(async () => vi.advanceTimersByTime(300));
    expect(fake.fetches.length).toBe(3);
    await act(async () => fake.fetches[2].resolve(overall(1, 5)));
    await act(async () => fake.fetches[1].resolve(overall(1, 3)));
    expect(result.current.rows[0].points).toBe(5);
  });
});

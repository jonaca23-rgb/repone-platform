import { describe, expect, it } from "vitest";
import { activeTabHref } from "./EventTabs";

const BASE = "/producer/events/e1";
const ITEMS = [
  { href: `${BASE}/dashboard` },
  { href: `${BASE}/production` },
  { href: `${BASE}/scores` },
];

describe("activeTabHref", () => {
  it.each([
    [`${BASE}/dashboard`, `${BASE}/dashboard`],
    [`${BASE}/production`, `${BASE}/production`],
    [`${BASE}/scores/r1`, `${BASE}/scores`],
    [`${BASE}/productions`, null],
    [`${BASE}`, null],
  ])("%s marks %s", (path, expected) => {
    expect(activeTabHref(ITEMS, path)).toBe(expected);
  });

  it("prefers the longest matching tab", () => {
    expect(activeTabHref([{ href: "/a" }, { href: "/a/b" }], "/a/b/c")).toBe("/a/b");
  });
});

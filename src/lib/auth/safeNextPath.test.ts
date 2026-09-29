import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safeNextPath";

describe("safeNextPath", () => {
  it("keeps same-site paths, with query and hash", () => {
    expect(safeNextPath("/athlete", "/")).toBe("/athlete");
    expect(safeNextPath("/athlete/messages?x=1#top", "/")).toBe("/athlete/messages?x=1#top");
  });

  it("falls back when missing or empty", () => {
    expect(safeNextPath(null, "/athlete")).toBe("/athlete");
    expect(safeNextPath("", "/athlete")).toBe("/athlete");
  });

  it.each([
    "@evil.com",
    ".evil.com",
    "evil.com",
    "//evil.com",
    "/\\evil.com",
    "\\\\evil.com",
    "https://evil.com",
    "javascript:alert(1)",
  ])("rejects %s", (next) => {
    expect(safeNextPath(next, "/athlete")).toBe("/athlete");
  });
});

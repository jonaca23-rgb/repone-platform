import { describe, expect, it } from "vitest";
import { moduleMenuItems } from "./moduleMenuItems";

const modules = [
  { kind: "admin", href: "/admin", label: "Admin", detail: "RepOneLive" },
  { kind: "scorekeeper", href: "/scorekeeper", label: "Scorekeeper", detail: "Aprieta" },
] as const;

describe("moduleMenuItems", () => {
  it("lists Home first, then every module, marking the current one", () => {
    const items = moduleMenuItems([...modules], "scorekeeper");
    expect(items.map((i) => i.label)).toEqual(["Home", "Admin", "Scorekeeper"]);
    expect(items.filter((i) => i.current).map((i) => i.label)).toEqual(["Scorekeeper"]);
  });
  it("with no current module nothing is marked", () => {
    expect(moduleMenuItems([...modules], null).some((i) => i.current)).toBe(false);
  });
});

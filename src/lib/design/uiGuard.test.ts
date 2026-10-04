import { describe, expect, it } from "vitest";
import { checkSource } from "./uiGuard";

const rules = (src: string) => checkSource("x.tsx", src).map((v) => v.rule);

describe("ui guard", () => {
  it("rejects a user-facing throw in a migrated action file", () => {
    const file = "src/lib/actions/example.ts";
    expect(checkSource(file, 'throw new Error("Nope.");', [file]).map((v) => v.rule)).toEqual([
      "action-throw",
    ]);
    expect(checkSource(file, "throw new Error(error.message);", [file])).toEqual([]);
    expect(checkSource("src/lib/actions/other.ts", 'throw new Error("Nope.");', [file])).toEqual(
      [],
    );
  });
  it("rejects cards on an admin page unless marked", () => {
    const page = "src/app/(app)/admin/teams/page.tsx";
    expect(checkSource(page, "<Card>").map((v) => v.rule)).toEqual(["admin-card-list"]);
    expect(checkSource(page, "{/* ui-guard-ignore: summary */}\n<Card>")).toEqual([]);
    expect(checkSource("src/components/x.tsx", "<Card>")).toEqual([]);
    expect(checkSource("src/app/(app)/athlete/page.tsx", "<Card>")).toEqual([]);
    // A list moved into a sibling component is caught too.
    expect(checkSource("src/app/(app)/admin/foo/FooList.tsx", "<Card>").map((v) => v.rule)).toEqual(
      ["admin-card-list"],
    );
  });
  it("rejects vaul", () => {
    expect(rules('import { Drawer } from "vaul";')).toEqual(["vaul"]);
  });
  it("flags the old button and confirm patterns", () => {
    expect(rules(`<button className="control-btn control-btn-red">`)).toContain("control-btn");
    expect(rules(`if (!window.confirm("Delete?")) return;`)).toContain("confirm");
  });
  it("flags light-theme and hard-coded status colours", () => {
    expect(rules(`<p className="text-black/50">`)).toContain("light-colour");
    expect(rules(`<div className="bg-white">`)).toContain("light-colour");
    expect(rules(`<p className="text-black">`)).toContain("light-colour");
    expect(rules(`<span className="text-green-700">`)).toContain("status-colour");
  });
  it("flags dimmed text that fails AA", () => {
    expect(rules(`<p className="text-white/40">`)).toContain("dim-text");
    expect(rules(`<p className="text-foreground/50">`)).toContain("dim-text");
    expect(rules(`<p className="text-white/80">`)).not.toContain("dim-text");
  });
  it("flags raw form controls outside components/ui, except hidden inputs", () => {
    expect(rules(`<select name="x">`)).toContain("raw-control");
    expect(rules(`<input name="email" />`)).toContain("raw-control");
    expect(rules(`<input type="hidden" name="id" value={id} />`)).not.toContain("raw-control");
  });
  it("flags outline-none without a focus-visible style, and nav emojis", () => {
    expect(rules(`className="outline-none border"`)).toContain("focus");
    expect(rules(`className="outline-none focus-visible:ring-2"`)).not.toContain("focus");
    expect(rules(`<Link>🏠 Home</Link>`)).toContain("emoji");
  });
  it("passes clean shadcn code", () => {
    expect(rules(`<Button variant="destructive" size="touch">Save</Button>`)).toEqual([]);
  });
  it("exempts a marked code line, and only that line", () => {
    expect(rules(`<div className="bg-white"> {/* ui-guard-ignore: QR */}`)).toEqual([]);
    expect(
      rules(`<div className="bg-white"> {/* ui-guard-ignore: QR */}\n<input name="x" />`),
    ).toEqual(["raw-control"]);
    expect(rules(`<div className="bg-white">`)).toContain("light-colour");
  });
  it("exempts the line after a comment-only marker", () => {
    expect(rules(`// ui-guard-ignore: QR\n<div className="bg-white">`)).toEqual([]);
    expect(rules(`{/* ui-guard-ignore: QR */}\n<div className="bg-white">`)).toEqual([]);
    expect(rules(`// ui-guard-ignore: QR\n<p>ok</p>\n<div className="bg-white">`)).toContain(
      "light-colour",
    );
  });
  it("ignores a marker without a reason", () => {
    expect(rules(`<div className="bg-white"> // ui-guard-ignore`)).toContain("light-colour");
    expect(rules(`// ui-guard-ignore\n<div className="bg-white">`)).toContain("light-colour");
    expect(rules(`// ui-guard-ignore:\n<div className="bg-white">`)).toContain("light-colour");
  });
});

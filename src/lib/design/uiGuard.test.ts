import { describe, expect, it } from "vitest";
import { checkSource } from "./uiGuard";

const rules = (src: string) => checkSource("x.tsx", src).map((v) => v.rule);

describe("ui guard", () => {
  it("flags the old button and confirm patterns", () => {
    expect(rules(`<button className="control-btn control-btn-red">`)).toContain("control-btn");
    expect(rules(`if (!window.confirm("Delete?")) return;`)).toContain("confirm");
  });
  it("flags light-theme and hard-coded status colours", () => {
    expect(rules(`<p className="text-black/50">`)).toContain("light-colour");
    expect(rules(`<div className="bg-repone-white">`)).toContain("light-colour");
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

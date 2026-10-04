import { describe, expect, it } from "vitest";
import { rowActionLayout } from "./row-actions";

describe("rowActionLayout", () => {
  it("puts the primary action on a button and destructive ones last, set apart", () => {
    expect(
      rowActionLayout({
        primary: { label: "Mark paid" },
        secondary: [{ label: "Waive" }, { label: "Edit payment" }],
        destructive: [{ label: "Refund" }],
      }),
    ).toEqual({ button: "Mark paid", menu: ["Waive", "Edit payment", "—", "Refund"] });
  });

  it("has no separator without both groups", () => {
    expect(rowActionLayout({ destructive: [{ label: "Delete" }] })).toEqual({
      button: null,
      menu: ["Delete"],
    });
  });
});

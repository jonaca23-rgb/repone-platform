// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState";

afterEach(cleanup);

describe("EmptyState", () => {
  it("renders the title as a paragraph by default", () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByText("Nothing here").tagName).toBe("P");
  });

  it("renders the title as the requested heading", () => {
    render(<EmptyState title="Page not found" titleAs="h1" />);
    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeTruthy();
  });
});

// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.stubGlobal("matchMedia", (q: string) => ({
  matches: false,
  media: q,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));

import { CommentatorAthletesTable } from "./CommentatorAthletesTable";

const ROWS = [
  {
    id: "r1",
    name: "Maria Rivera",
    sortName: "Rivera Maria",
    bib: "12",
    division: "Intermediate Female",
    affiliate: "CrossFit Aprieta",
  },
  {
    id: "r2",
    name: "Ana López",
    sortName: "López Ana",
    bib: null,
    division: "Rx Female",
    affiliate: null,
  },
];

afterEach(cleanup);

describe("CommentatorAthletesTable", () => {
  it("shows bib, division and affiliate", () => {
    render(
      <CommentatorAthletesTable rows={ROWS} divisions={["Intermediate Female", "Rx Female"]} />,
    );
    expect(screen.getByText("#12")).toBeTruthy();
    expect(screen.getByText("CrossFit Aprieta")).toBeTruthy();
  });

  it("searches by name", async () => {
    render(
      <CommentatorAthletesTable rows={ROWS} divisions={["Intermediate Female", "Rx Female"]} />,
    );
    await userEvent.setup().type(screen.getByRole("searchbox", { name: "Search athletes" }), "ana");
    expect(screen.queryByText("Maria Rivera")).toBeNull();
    expect(screen.getByText("Ana López")).toBeTruthy();
  });
});

// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { dataTableColumns } from "@/lib/data-table";
import { DataTable } from "./DataTable";

type Row = { id: string; name: string; tier: string };
const col = dataTableColumns<Row>();
const columns = [
  col.accessor("name", { header: "Sponsor" }),
  col.accessor("tier", { header: "Tier", filterFn: "equals", meta: { priority: "low" } }),
];
const rows: Row[] = Array.from({ length: 30 }, (_, i) => ({
  id: String(i),
  name: i === 0 ? "Hoka" : `Sponsor ${String(i).padStart(2, "0")}`,
  tier: i % 2 ? "logo" : "wod",
}));

function setup(data = rows) {
  render(
    <DataTable
      columns={columns}
      data={data}
      getRowId={(r) => r.id}
      search={{ label: "Search sponsors", placeholder: "Search…" }}
      filters={[
        {
          columnId: "tier",
          label: "Tier",
          allLabel: "All tiers",
          options: [
            ["logo", "Logo"],
            ["wod", "WOD"],
          ],
        },
      ]}
      empty={<p>No sponsors yet</p>}
    />,
  );
  return userEvent.setup();
}

const bodyRows = () => within(screen.getAllByRole("rowgroup")[1]).getAllByRole("row");

afterEach(cleanup);

describe("DataTable", () => {
  it("pages at 25 rows", () => {
    setup();
    expect(bodyRows()).toHaveLength(25);
    expect(screen.getByText("30 results")).toBeTruthy();
  });

  it("stays on its page when the server sends fresh rows", async () => {
    const { rerender } = render(
      <DataTable columns={columns} data={rows} getRowId={(r) => r.id} empty={<p>none</p>} />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByText("2 / 2")).toBeTruthy();
    rerender(
      <DataTable
        columns={columns}
        data={rows.map((r) => ({ ...r }))}
        getRowId={(r) => r.id}
        empty={<p>none</p>}
      />,
    );
    // TanStack resets the page after it rebuilds the row model, a tick later.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(screen.getByText("2 / 2")).toBeTruthy();
  });

  it("goes back to page 1 when the search changes", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: /Next/ }));
    await user.type(screen.getByRole("searchbox", { name: "Search sponsors" }), "sponsor 0");
    expect(bodyRows()).toHaveLength(9);
  });

  it("searches", async () => {
    const user = setup();
    await user.type(screen.getByRole("searchbox", { name: "Search sponsors" }), "hoka");
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByText("Hoka")).toBeTruthy();
  });

  it("says so when a search matches nothing, and clears it", async () => {
    const user = setup();
    await user.type(screen.getByRole("searchbox", { name: "Search sponsors" }), "zzz");
    expect(screen.getByText("No results.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(bodyRows()).toHaveLength(25);
  });

  it("shows the empty state for an empty list", () => {
    setup([]);
    expect(screen.getByText("No sponsors yet")).toBeTruthy();
  });

  it("sorts by a column header", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: /Sponsor/ }));
    expect(within(bodyRows()[0]).getByText("Hoka")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Sponsor/ }));
    expect(within(bodyRows()[0]).getByText("Sponsor 29")).toBeTruthy();
  });

  it("shows each filter's current choice", () => {
    setup();
    expect(screen.getByRole("combobox", { name: "Tier" }).textContent).toContain("All tiers");
  });

  it("lets cells wrap on a phone so every column fits", () => {
    setup();
    const cell = screen.getByText("Hoka").closest("td");
    expect(cell?.className).toContain("max-md:whitespace-normal");
  });

  it("hides low-priority columns below md", () => {
    setup();
    const tierHeader = screen.getByRole("columnheader", { name: /Tier/ });
    expect(tierHeader.className).toContain("max-md:hidden");
  });
});

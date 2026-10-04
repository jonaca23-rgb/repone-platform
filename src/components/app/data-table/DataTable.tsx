"use client";

import { type ColumnDef, useTable } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type DataTableFeatures, dataTableFeatures } from "@/lib/data-table";
import { cn } from "@/lib/utils";
import { TablePagination } from "./TablePagination";
import { TableToolbar } from "./TableToolbar";

/*
 * A row's primary action sits under its name on a phone (the row-actions
 * design), yet a table cell cannot wrap to a line of its own. So below md, in
 * a row whose actions have a primary button (`RowActions` marks it with
 * `data-row-primary`), the actions are laid along the row's bottom edge, the
 * table's full width.
 *
 * Their containing block is their own cell, made `relative` — the one table
 * part every engine honours as one. A table row is not: WebKit (every iPhone
 * browser) ignores `relative` on a <tr>, and mis-sizes a transformed one, so
 * rows' actions would land at the bottom of the table. The cell is the row's
 * last and its full height, so the line sits at its bottom-right, and it is
 * as wide as the table: the frame is a size container, and 100cqw is its
 * width. Every other cell leaves room under its content for the line — 44px,
 * plus 8px of padding and an 8px gap — so whichever cell is tallest, nothing
 * runs under it; they align to the top, so the name leads. No `display`
 * changes, so the table keeps its row and cell semantics.
 *
 * The actions render once — never a phone and a desktop copy, whose dialogs
 * would open twice. A row whose actions are only the "⋯" keeps it beside the
 * name. (Adapted from school-schedule's DataTable.)
 */
const PHONE_CELL =
  "max-md:[tr:has([data-row-primary])_&]:pb-15 max-md:[tr:has([data-row-primary])_&]:align-top";
// Spelled out in full: Tailwind finds classes by scanning the source.
const ROW_ACTIONS_CELL = cn(
  "w-0 max-md:has-[[data-row-primary]]:relative max-md:has-[[data-row-primary]]:p-0",
  "max-md:[&:has([data-row-primary])>*]:absolute max-md:[&:has([data-row-primary])>*]:right-2",
  "max-md:[&:has([data-row-primary])>*]:bottom-2 max-md:[&:has([data-row-primary])>*]:w-[calc(100cqw-1rem)]",
);

/** Radix Select reserves "" for "nothing chosen", so "all" is its own value. */
const ALL = "all";

export type DataTableFilter = {
  columnId: string;
  label: string;
  /** The option that clears the filter, e.g. "All tiers". */
  allLabel: string;
  options: readonly (readonly [value: string, label: string])[];
};

/**
 * Every admin list: search, filters, sortable headers, 25 rows a page, and
 * the screen's own empty state. The rows are already loaded by the server
 * component, so all of this runs on the client.
 */
export function DataTable<TData extends object>({
  columns,
  data,
  getRowId,
  search,
  filters = [],
  toolbar,
  empty,
  initialSorting = [],
  pageSize = 25,
}: {
  // `any` is TanStack's own convention for a heterogeneous column array: each
  // accessor keeps its own value type, which `unknown` would erase.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<DataTableFeatures, TData, any>[];
  data: TData[];
  getRowId: (row: TData) => string;
  search?: { label: string; placeholder: string };
  filters?: DataTableFilter[];
  /** The list's primary action(s), e.g. "+ Add sponsor". */
  toolbar?: React.ReactNode;
  /** What to show when the list itself is empty. */
  empty: React.ReactNode;
  initialSorting?: { id: string; desc: boolean }[];
  pageSize?: number;
}) {
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId,
    globalFilterFn: "includesString",
    getColumnCanGlobalFilter: (column) =>
      !(column.columnDef.meta as { rowActions?: true } | undefined)?.rowActions,
    // The server sends a fresh rows array after every save (router.refresh),
    // which would otherwise send the person back to page 1 mid-task. Search
    // and filters reset the page themselves, below.
    autoResetPageIndex: false,
    initialState: {
      pagination: { pageIndex: 0, pageSize },
      sorting: initialSorting,
    },
  });

  const rows = table.getRowModel().rows;
  // With no selector, useTable selects every registered slice onto table.state.
  const state = table.state;
  const total = table.getFilteredRowModel().rows.length;
  const clear = () => {
    table.setGlobalFilter("");
    table.resetColumnFilters();
    table.setPageIndex(0);
  };

  return (
    <div className="grid grid-cols-1 gap-3">
      {search || filters.length > 0 || toolbar ? (
        <TableToolbar actions={toolbar}>
          {search ? (
            <Input
              type="search"
              aria-label={search.label}
              placeholder={search.placeholder}
              value={(state.globalFilter as string | undefined) ?? ""}
              onChange={(e) => {
                table.setGlobalFilter(e.target.value);
                table.setPageIndex(0);
              }}
              className="w-full sm:max-w-xs"
            />
          ) : null}
          {filters.map((f) => (
            <Select
              key={f.columnId}
              value={(table.getColumn(f.columnId)?.getFilterValue() as string | undefined) ?? ALL}
              onValueChange={(v) => {
                table.getColumn(f.columnId)?.setFilterValue(v === ALL ? undefined : v);
                table.setPageIndex(0);
              }}
            >
              <SelectTrigger aria-label={f.label} className="w-full sm:w-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{f.allLabel}</SelectItem>
                {f.options.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        </TableToolbar>
      ) : null}

      {/* A size container: a lifted actions line is as wide as this frame (100cqw). */}
      <div className="@container rounded-lg border border-border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => {
                  const meta = header.column.columnDef.meta;
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : undefined
                      }
                      className={cn(
                        meta?.priority === "low" && "max-md:hidden",
                        meta?.rowActions && "w-0",
                        meta?.className,
                      )}
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-ml-2.5"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <table.FlexRender header={header} />
                          {sorted === "asc" ? (
                            <ArrowUp aria-hidden />
                          ) : sorted === "desc" ? (
                            <ArrowDown aria-hidden />
                          ) : (
                            <ArrowUpDown aria-hidden className="text-muted-foreground" />
                          )}
                        </Button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getAllCells().map((cell) => {
                    const meta = cell.column.columnDef.meta;
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          // shadcn cells never wrap; on a phone they must, or the
                          // last columns (the switch, the actions) fall off-screen.
                          "align-middle max-md:whitespace-normal max-md:[overflow-wrap:anywhere]",
                          meta?.priority === "low" && "max-md:hidden",
                          meta?.rowActions ? ROW_ACTIONS_CELL : PHONE_CELL,
                          meta?.className,
                        )}
                      >
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="whitespace-normal p-0">
                  {data.length === 0 ? (
                    empty
                  ) : (
                    <div className="flex flex-col items-center gap-1 py-8 text-center text-muted-foreground">
                      <p>No results.</p>
                      <Button variant="link" onClick={clear}>
                        Clear search
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {total > 0 ? (
        <TablePagination
          total={total}
          page={state.pagination.pageIndex + 1}
          pageCount={table.getPageCount()}
          onPrevious={() => table.previousPage()}
          onNext={() => table.nextPage()}
        />
      ) : null}
    </div>
  );
}

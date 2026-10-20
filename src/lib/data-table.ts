import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_equals,
  filterFn_includesString,
  globalFilteringFeature,
  metaHelper,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table";

/**
 * The feature set every admin list shares. Admin lists are tens to a few
 * hundred rows, already loaded by the server component, so search, filters,
 * sorting and pagination run on the client.
 */
export const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { includesString: filterFn_includesString, equals: filterFn_equals },
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text, basic: sortFn_basic },
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
  columnMeta: metaHelper<{
    /** Classes for the column's header and cells. */
    className?: string;
    /** "low": hidden below md, so a phone shows only what matters. */
    priority?: "low";
    /** The row's actions column (`RowActions`). */
    rowActions?: true;
  }>(),
});

export type DataTableFeatures = typeof dataTableFeatures;

/** The typed column helper for one list's rows. */
export function dataTableColumns<TData extends object>() {
  return createColumnHelper<DataTableFeatures, TData>();
}

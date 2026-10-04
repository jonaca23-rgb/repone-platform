"use client";

import { createContext, use } from "react";

/**
 * What a table's cells need beyond their row (the event's id, its fees…).
 *
 * Columns live at module scope so each cell renderer is the same function on
 * every render: TanStack renders a cell with createElement(def.cell), so a
 * renderer recreated per render is a new component type, and React remounts
 * it, closing any dialog a row has open whenever router.refresh() lands.
 * Cells read the rest from this context instead of a closure.
 */
export function createTableContext<T>(name: string) {
  const Context = createContext<T | null>(null);
  function useTableContext(): T {
    const value = use(Context);
    if (value === null) throw new Error(`${name} cells must render inside its provider.`);
    return value;
  }
  return [Context.Provider, useTableContext] as const;
}

import type { TableWatch } from "./useRefreshOnChanges";

// Realtime "in" filters accept at most 100 values; a floor never has that
// many heats in practice, and heat inserts/deletes are caught by floor_id.
const MAX_IN_FILTER = 100;

/** Heats on this floor, plus lanes (and optionally results) of those heats. */
export function floorWatches(
  floorId: string,
  heatIds: string[],
  options: { results?: boolean } = {},
): TableWatch[] {
  const ids = heatIds.slice(0, MAX_IN_FILTER);
  const inHeats = ids.length ? `heat_id=in.(${ids.join(",")})` : null;
  return [
    { table: "heats", filter: `floor_id=eq.${floorId}` },
    ...(inHeats ? [{ table: "lanes" as const, filter: inHeats }] : []),
    ...(inHeats && options.results ? [{ table: "results" as const, filter: inHeats }] : []),
  ];
}

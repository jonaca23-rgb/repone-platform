/**
 * Which heat the scorekeeper sees. An open score drawer holds its heat, so
 * Production moving the live heat never swaps the athlete under a half-typed
 * score; closing the drawer releases it. Otherwise: the live heat while
 * following, else the heat picked by hand.
 */
export function activeHeatId({
  following,
  manualHeatId,
  liveHeatId,
  heldHeatId,
  firstHeatId,
}: {
  following: boolean;
  manualHeatId: string | null;
  liveHeatId: string | null;
  heldHeatId: string | null;
  firstHeatId: string | null;
}): string | null {
  if (heldHeatId) return heldHeatId;
  if (following) return liveHeatId ?? firstHeatId;
  return manualHeatId ?? firstHeatId;
}

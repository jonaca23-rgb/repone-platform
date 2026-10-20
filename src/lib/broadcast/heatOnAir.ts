/**
 * Which heat the production dashboard shows, and whether it is actually on
 * air. broadcast_state.current_heat_id is what every overlay reads; it starts
 * out null on a fresh floor. The dashboard still shows the first heat then (so
 * there is something to put on air), but must say it isn't on air: showing it
 * as current while overlays render nothing is how a one-heat floor ended up
 * with no way to go live (Previous/Next were the only way to write the heat).
 */
export function heatOnAir(
  heats: ReadonlyArray<{ id: string }>,
  currentHeatId: string | null,
): { index: number; onAir: boolean } {
  const onAirIndex = heats.findIndex((h) => h.id === currentHeatId);
  if (onAirIndex >= 0) return { index: onAirIndex, onAir: true };
  return { index: heats.length > 0 ? 0 : -1, onAir: false };
}

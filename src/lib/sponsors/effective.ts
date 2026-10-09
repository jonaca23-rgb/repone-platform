/**
 * What a sponsorship gets on the venue display: the package's defaults,
 * with the event sponsorship's overrides on top (docs/specs/venue-display.md "Sponsor
 * frequency engine"). The only place these are combined.
 */
export function effectiveDisplay(
  pkg: { display_enabled: boolean; display_duration_seconds: number; display_weight: number },
  s: { display_duration_override: number | null; display_weight_override: number | null },
): { enabled: boolean; durationSeconds: number; weight: number } {
  return {
    enabled: pkg.display_enabled,
    durationSeconds: s.display_duration_override ?? pkg.display_duration_seconds,
    weight: s.display_weight_override ?? pkg.display_weight,
  };
}

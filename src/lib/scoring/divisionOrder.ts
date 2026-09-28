// Pure, framework-free comparator for the running order Jonathan wants
// WODs/divisions/heats to appear in — no UI or DB imports, unit-tested in
// isolation like the rest of lib/scoring.
//
// Jonathan runs one WOD all the way through — every division's heats —
// before moving to the next WOD, in the order the WODs were entered (e.g.
// Fran fully, then Grace). Within a WOD, divisions run back-to-back rather
// than interleaved: any Beginner division's heats first, then Scale/Scaled,
// then Rx — and within each of those skill tiers, Male before Female. For
// example: Fran's Scale Male 1/2, Scale Male 2/2, Scale Female 1/2, Scale
// Female 2/2, Rx Male 1/2, Rx Male 2/2, Rx Female 1/2, Rx Female 2/2 — then
// the same pattern for Grace.
//
// The division/gender part is derived purely from each division's NAME (no
// schema change, no manual reordering step, no dependency on
// divisions.sort_order — which every division defaults to 0 for and nothing
// currently sets to anything else). The WOD part uses each WOD's
// `created_at` timestamp as "the order it was entered" — wods.sort_order has
// the exact same problem as divisions.sort_order (defaults to 0, nothing
// sets it), but unlike a division's skill level/gender, a WOD's place in the
// running order can't be guessed from its name ("Fran" vs. "Grace" carries
// no ordering information), so entry order is the only signal available.
//
// Used everywhere heats are generated or listed: the admin Heats & Lanes
// list and its "Next Up" pick, the heat detail page's Previous/Next
// navigation, the Score Keeper/Production Dashboard heat picker, every OBS
// overlay, and the public Live Leaderboard's division order.
//
// A division name that doesn't match any known skill-level or gender
// keyword sorts after the ones that do (alphabetically, for a stable order
// among themselves), rather than erroring or landing unpredictably in the
// middle — so an odd one-off division name (e.g. "Masters", "Teens") never
// scrambles the groups Jonathan does rely on this for.

const SKILL_LEVEL_PATTERNS: Array<{ pattern: RegExp; rank: number }> = [
  { pattern: /beginner/i, rank: 0 },
  { pattern: /scaled?/i, rank: 1 },
  { pattern: /\brx\b/i, rank: 2 },
];
const UNKNOWN_SKILL_LEVEL_RANK = 3;

const GENDER_PATTERNS: Array<{ pattern: RegExp; rank: number }> = [
  { pattern: /\b(male|men|mens|man)\b/i, rank: 0 },
  { pattern: /\b(female|women|womens|woman)\b/i, rank: 1 },
];
const UNKNOWN_GENDER_RANK = 2;

function rankFor(name: string, patterns: Array<{ pattern: RegExp; rank: number }>, fallback: number): number {
  for (const { pattern, rank } of patterns) {
    if (pattern.test(name)) return rank;
  }
  return fallback;
}

/** Compares two division names for Jonathan's fixed running order: skill
 * level (Beginner, Scale/Scaled, Rx, then anything else), then gender (Male,
 * Female, then anything else), then alphabetically as a final stable
 * tiebreak. */
export function compareDivisionNames(aName: string, bName: string): number {
  const skillDiff = rankFor(aName, SKILL_LEVEL_PATTERNS, UNKNOWN_SKILL_LEVEL_RANK) - rankFor(bName, SKILL_LEVEL_PATTERNS, UNKNOWN_SKILL_LEVEL_RANK);
  if (skillDiff !== 0) return skillDiff;

  const genderDiff = rankFor(aName, GENDER_PATTERNS, UNKNOWN_GENDER_RANK) - rankFor(bName, GENDER_PATTERNS, UNKNOWN_GENDER_RANK);
  if (genderDiff !== 0) return genderDiff;

  return aName.localeCompare(bName);
}

/** Full running order for heats: groups every heat by its WOD first (in the
 * order that WOD was entered — see the file header on why entry order, not
 * name, drives this part), then by division within that WOD (Jonathan's
 * fixed skill-level/gender order above), then by heat number within that
 * division. */
export function compareHeatsForRunningOrder(
  a: { wodCreatedAt: string; divisionName: string; heatNumber: number },
  b: { wodCreatedAt: string; divisionName: string; heatNumber: number }
): number {
  const wodDiff = Date.parse(a.wodCreatedAt) - Date.parse(b.wodCreatedAt);
  if (wodDiff !== 0) return wodDiff;

  const divisionDiff = compareDivisionNames(a.divisionName, b.divisionName);
  if (divisionDiff !== 0) return divisionDiff;

  return a.heatNumber - b.heatNumber;
}

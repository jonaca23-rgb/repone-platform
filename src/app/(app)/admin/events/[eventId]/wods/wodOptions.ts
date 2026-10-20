import { type ScoringType, scoringLabel } from "@/lib/scoring/format";

const SCORING_ORDER: readonly ScoringType[] = [
  "for_time",
  "amrap",
  "tabata",
  "max_load",
  "points",
  "other",
];

/** The WOD form's choices: the labels every screen uses, with Tabata's scoring spelled out. */
export const SCORING_TYPES = SCORING_ORDER.map(
  (type) => [type, type === "tabata" ? "Tabata (total reps)" : scoringLabel(type)] as const,
);

/** The WOD table's filter: the labels as the table shows them. */
export const SCORING_FILTER = SCORING_ORDER.map((type) => [type, scoringLabel(type)] as const);

export const TIEBREAKS = [
  ["none", "None"],
  ["time", "Time"],
  ["reps", "Reps"],
  ["load", "Load"],
  ["points", "Points"],
] as const;

export const TIEBREAK_LABEL = Object.fromEntries(TIEBREAKS) as Record<string, string>;

export const SCORING_TYPES = [
  ["for_time", "For Time"],
  ["amrap", "AMRAP"],
  ["max_load", "Max Load"],
  ["points", "Points"],
  ["other", "Other"],
] as const;

export const TIEBREAKS = [
  ["none", "None"],
  ["time", "Time"],
  ["reps", "Reps"],
  ["load", "Load"],
  ["points", "Points"],
] as const;

export const SCORING_LABEL = Object.fromEntries(SCORING_TYPES) as Record<string, string>;
export const TIEBREAK_LABEL = Object.fromEntries(TIEBREAKS) as Record<string, string>;

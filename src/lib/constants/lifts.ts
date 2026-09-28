// The 9 basic barbell lifts tracked per athlete — recorded as a weight (lbs).
export const WEIGHT_LIFT_NAMES = [
  "deadlift",
  "bench_press",
  "strict_press",
  "back_squat",
  "front_squat",
  "clean",
  "squat_clean",
  "snatch",
  "power_snatch",
] as const;

// Conditioning benchmarks recorded as a time (mm:ss) instead of a weight —
// added 2026-09-15 alongside the 9 barbell lifts in the same "Basic Lifts"
// section/table (`athlete_lifts.time_seconds`), since they're PRs an athlete
// tracks the same way (one current best per named entry).
export const TIME_LIFT_NAMES = ["run_400m", "run_1_mile", "run_5k"] as const;

// (matches the `lift_name` Postgres enum, which now includes both groups)
export const LIFT_NAMES = [...WEIGHT_LIFT_NAMES, ...TIME_LIFT_NAMES] as const;

export type LiftName = (typeof LIFT_NAMES)[number];

export function isTimeLift(lift: LiftName): boolean {
  return (TIME_LIFT_NAMES as readonly string[]).includes(lift);
}

export const LIFT_LABELS: Record<LiftName, string> = {
  deadlift: "Deadlift",
  bench_press: "Bench Press",
  strict_press: "Strict Press",
  back_squat: "Back Squat",
  front_squat: "Front Squat",
  clean: "Clean",
  squat_clean: "Squat Clean",
  snatch: "Snatch",
  power_snatch: "Power Snatch",
  run_400m: "400m Run",
  run_1_mile: "1 Mile Run",
  run_5k: "5K Run",
};

// Suggestions only, shown in the benchmark name's datalist — athletes can log
// any named (or custom) benchmark, this just pre-fills the common ones.
export const COMMON_BENCHMARKS = ["Fran", "Karen", "Isabel", "Grace", "Diane", "Helen", "Cindy", "Annie", "Murph"];

import { formatClock } from "@/lib/timer/compute";

export type ScoringType = "for_time" | "amrap" | "max_load" | "points" | "other";
export type ResultStatus = "completed" | "dns" | "dnf" | "dq";

/** One saved result, as the lane list and the score drawer read it. */
export interface LaneResult {
  athlete_id: string | null;
  time_seconds: number | null;
  reps: number | null;
  load: number | null;
  points: number | null;
  capped: boolean;
  status: ResultStatus;
  tiebreak_value: number | null;
  manually_adjusted: boolean;
}

/** A lane with an athlete in it. */
export interface ScoringLane {
  laneNumber: number;
  athleteId: string;
  name: string;
  affiliate: string | null;
}

/** 225 → { "3", "45" }; 65.5 → { "1", "05.5" }; null → blanks. */
export function splitClock(seconds: number | null): { minutes: string; seconds: string } {
  if (seconds === null) return { minutes: "", seconds: "" };
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round((seconds - minutes * 60) * 1000) / 1000;
  const [whole, fraction] = String(rest).split(".");
  return {
    minutes: String(minutes),
    seconds: whole.padStart(2, "0") + (fraction ? `.${fraction}` : ""),
  };
}

/**
 * The two fields as the "m:ss" the server's clock field reads. Doesn't
 * validate: "3" + "7x" posts "3:7x" and the server names the error.
 */
export function joinClock(minutes: string, seconds: string): string {
  const m = minutes.trim();
  const s = seconds.trim();
  if (!m && !s) return "";
  const sec = !s ? "00" : /^\d$/.test(s) ? `0${s}` : s;
  return `${m || "0"}:${sec}`;
}

/** The score a lane row shows: "04:12", "CAP 87", "87 reps", "120", "42 pts", "DNF" or "—". */
export function scoreSummary(result: LaneResult | undefined, scoringType: ScoringType): string {
  if (!result) return "—";
  if (result.status !== "completed") return result.status.toUpperCase();
  if (scoringType === "for_time") {
    if (result.capped) return result.reps === null ? "CAP" : `CAP ${result.reps}`;
    return result.time_seconds === null ? "—" : formatClock(result.time_seconds);
  }
  if (scoringType === "amrap") return result.reps === null ? "—" : `${result.reps} reps`;
  if (scoringType === "max_load") return result.load === null ? "—" : String(result.load);
  return result.points === null ? "—" : `${result.points} pts`;
}

const SCORING_LABEL: Record<string, string> = {
  for_time: "For time",
  amrap: "AMRAP",
  max_load: "Max load",
  points: "Points",
  other: "Other",
};

/** "For time", "AMRAP"…; an unknown type reads as its words. */
export function scoringLabel(scoringType: string): string {
  return SCORING_LABEL[scoringType] ?? scoringType.replace(/_/g, " ");
}

/** "WOD 2 · For time · 15 min cap" — a WOD in one line. */
export function wodSummary(wod: {
  name: string;
  scoring_type: string;
  time_cap_seconds: number | null;
}): string {
  const cap = wod.time_cap_seconds ? ` · ${Math.round(wod.time_cap_seconds / 60)} min cap` : "";
  return `${wod.name} · ${scoringLabel(wod.scoring_type)}${cap}`;
}

/** 1 → "1st", 12 → "12th", 22 → "22nd": a placing as people say it. */
export function ordinal(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  const suffix = ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}

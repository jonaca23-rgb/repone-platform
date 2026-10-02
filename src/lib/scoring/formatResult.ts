import { formatClock } from "../timer/compute";
import type { ScoringType } from "./types";

export interface ResultValue {
  time_seconds: number | null;
  reps: number | null;
  load: number | null;
  points: number | null;
  capped: boolean;
  status: "completed" | "dns" | "dnf" | "dq";
}

/** One raw result as broadcast and screens show it, by the WOD's scoring type. */
export function formatResult(result: ResultValue | null, scoringType: ScoringType): string {
  if (!result) return "—";
  if (result.status !== "completed") return result.status.toUpperCase();
  switch (scoringType) {
    case "for_time":
      if (result.capped) return result.reps != null ? `CAP+${result.reps}` : "CAP";
      return result.time_seconds != null ? formatClock(Number(result.time_seconds)) : "—";
    case "amrap":
      return result.reps != null ? `${result.reps} reps` : "—";
    case "max_load":
      return result.load != null ? `${Number(result.load)} lb` : "—";
    default:
      return result.points != null ? `${Number(result.points)} pts` : "—";
  }
}

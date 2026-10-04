import type { ActiveGraphic, Database, TimerStatus } from "@/lib/db/database.types";

type BroadcastStateRow = Database["public"]["Tables"]["broadcast_state"]["Row"];

export interface OnAirHeat {
  id: string;
  heatNumber: number;
  heatCount: number | null;
  wod: { name: string };
  division: { name: string };
  lanes: Array<{ athleteId: string | null; name: string | null }>;
}

export interface OnAirSummary {
  heatLabel: string | null;
  graphicLabel: string;
  lowerThirdName: string | null;
  sponsorName: string | null;
  timerStateLabel: string;
}

export const GRAPHIC_LABEL: Record<ActiveGraphic, string> = {
  none: "None",
  heat_intro: "Heat intro",
  lanes: "Lanes",
  wod: "WOD",
  timer: "Timer",
  score: "Score",
  leaderboard: "Leaderboard",
  lower_third: "Lower third",
  sponsor: "Sponsor",
};

const TIMER_STATE_LABEL: Record<TimerStatus, string> = {
  idle: "Idle",
  running: "Running",
  paused: "Paused",
  ended: "Ended",
};

/** "WOD 2 · Heat 6 / 9" — the heat's name on the board and in its confirmations. */
export function heatName(h: Pick<OnAirHeat, "heatNumber" | "heatCount" | "wod">): string {
  return `${h.wod.name} · Heat ${h.heatNumber}${h.heatCount ? ` / ${h.heatCount}` : ""}`;
}

/**
 * What the audience sees right now, in words, for the On air bar. An id that
 * no longer resolves (athlete unlaned, sponsor deactivated) is still on air,
 * so it reads "On air" rather than "None".
 */
export function onAirSummary(
  state: Pick<
    BroadcastStateRow,
    | "current_heat_id"
    | "active_graphic"
    | "lower_third_athlete_id"
    | "active_sponsor_id"
    | "timer_status"
  > | null,
  heats: OnAirHeat[],
  sponsors: Array<{ id: string; business_name: string }>,
): OnAirSummary {
  const heat = heats.find((h) => h.id === state?.current_heat_id) ?? null;
  const athleteId = state?.lower_third_athlete_id ?? null;
  const sponsorId = state?.active_sponsor_id ?? null;
  return {
    heatLabel: heat ? `${heatName(heat)} · ${heat.division.name}` : null,
    graphicLabel: GRAPHIC_LABEL[state?.active_graphic ?? "none"],
    lowerThirdName: athleteId
      ? (heats.flatMap((h) => h.lanes).find((l) => l.athleteId === athleteId)?.name ?? "On air")
      : null,
    sponsorName: sponsorId
      ? (sponsors.find((s) => s.id === sponsorId)?.business_name ?? "On air")
      : null,
    timerStateLabel: TIMER_STATE_LABEL[state?.timer_status ?? "idle"],
  };
}

/** A clock that is running or paused would be thrown away by Start. */
export function needsRestartConfirm(status: TimerStatus | undefined): boolean {
  return status === "running" || status === "paused";
}

/** Switching heats while the clock runs leaves it timing the old heat. */
export function needsHeatSwitchConfirm(status: TimerStatus | undefined): boolean {
  return status === "running" || status === "paused";
}

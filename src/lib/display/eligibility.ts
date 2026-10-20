import type { FloorHeat } from "@/lib/db/queries";
import { compareHeatsForRunningOrder } from "@/lib/scoring/divisionOrder";
import type { InfoBlockType, InfoSlot } from "./scheduler";

/** Offline for longer than this, heat/leaderboard info is hidden (docs/specs/venue-display.md "Reliability"). */
export const STALE_INFO_MS = 5 * 60_000;

export interface BlockSetting {
  type: InfoBlockType;
  enabled: boolean;
  durationSeconds: number;
  weight: number;
}

type HeatLike = Pick<FloorHeat, "id" | "heatNumber" | "endedAt" | "wod" | "division">;

const orderKey = (h: HeatLike) => ({
  wodCreatedAt: h.wod.created_at,
  divisionName: h.division.name,
  heatNumber: h.heatNumber,
});

/** The floor's live heat and the next unfinished one in running order. */
export function currentAndNextHeat<H extends HeatLike>(heats: H[], currentHeatId: string | null) {
  const ordered = [...heats].sort((a, b) => compareHeatsForRunningOrder(orderKey(a), orderKey(b)));
  const current = ordered.find((h) => h.id === currentHeatId) ?? null;
  const from = current ? ordered.indexOf(current) + 1 : 0;
  const next = ordered.slice(from).find((h) => !h.endedAt) ?? null;
  return { current, next };
}

export function eligibleInfoSlots(args: {
  blocks: BlockSetting[];
  current: { endedAt: string | null } | null;
  next: unknown | null;
  leaderboardRows: number;
  disconnectedSinceMs: number | null;
  nowMs: number;
}): InfoSlot[] {
  const { blocks, current, next, leaderboardRows, disconnectedSinceMs, nowMs } = args;
  if (disconnectedSinceMs !== null && nowMs - disconnectedSinceMs >= STALE_INFO_MS) return [];
  const has: Record<InfoBlockType, boolean> = {
    current_heat: !!current && !current.endedAt,
    next_heat: !!next,
    leaderboard: leaderboardRows > 0,
  };
  return blocks
    .filter((b) => b.enabled && has[b.type])
    .map(({ type, durationSeconds, weight }) => ({ type, durationSeconds, weight }));
}

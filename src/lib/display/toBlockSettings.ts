import type { BlockSetting } from "./eligibility";
import type { InfoBlockType } from "./scheduler";

const ORDER: InfoBlockType[] = ["current_heat", "next_heat", "leaderboard"];

/** A display's info-block rows, in one fixed order so the rotation is stable. */
export function toBlockSettings(
  rows: Array<{
    block_type: InfoBlockType;
    enabled: boolean;
    duration_seconds: number;
    weight: number;
  }>,
): BlockSetting[] {
  return [...rows]
    .sort((a, b) => ORDER.indexOf(a.block_type) - ORDER.indexOf(b.block_type))
    .map((r) => ({
      type: r.block_type,
      enabled: r.enabled,
      durationSeconds: r.duration_seconds,
      weight: r.weight,
    }));
}

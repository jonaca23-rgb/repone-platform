import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";

// Standings are written over the server's own connection (0038): no signed-in
// person's token can write them, so the leaderboard can't be edited around
// the results it is computed from. Only lib/scoring/recompute.ts calls this,
// and only from actions that have already authorized the person
// (requireHeatAccess in enterResult and finishHeat).

export interface StandingRow {
  athlete_id: string | null;
  team_id: string | null;
  placement: number | null;
  points: number | null;
}

/**
 * Replaces one division's standings for one WOD (or overall, with a null
 * WOD) atomically through replace_standings (0026), so concurrent saves queue
 * instead of interleaving into a duplicated or empty leaderboard.
 */
export async function replaceStandings(
  divisionId: string,
  wodId: string | null,
  rows: StandingRow[],
): Promise<void> {
  await db.execute(
    sql`select public.replace_standings(${divisionId}::uuid, ${wodId}::uuid, ${JSON.stringify(rows)}::jsonb)`,
  );
}

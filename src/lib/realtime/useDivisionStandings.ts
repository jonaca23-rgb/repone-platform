"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/db/client";
import {
  type DivisionStandingRow,
  pivotStandings,
  type RawStandingRow,
  type StandingsWod,
} from "@/lib/scoring/pivotStandings";

const EMPTY = { wods: [] as StandingsWod[], rows: [] as DivisionStandingRow[] };

/**
 * A division's live standings: overall place and points, plus each WOD's
 * placing. Refetches whenever `standings` changes for the division, so a saved
 * result reaches the live page without a refresh. The overlays keep
 * useStandings (overall only).
 */
export function useDivisionStandings(divisionId: string | null) {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(Boolean(divisionId));

  useEffect(() => {
    // A new division starts empty and loading, so the previous one's rows never show under it.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on division change
    setData(EMPTY);
    setLoading(Boolean(divisionId));
    if (!divisionId) return;
    const division = divisionId;
    const supabase = createClient();
    let cancelled = false;

    async function load() {
      const { data: raw } = await supabase
        .from("standings")
        .select(
          "wod_id, placement, points, athlete_id, team_id, athletes(first_name, last_name), teams(name), wods(id, name, created_at)",
        )
        .eq("division_id", division);
      if (cancelled) return;
      // See lib/db/queries.ts header comment: many-to-one embeds come back as single objects.
      setData(pivotStandings((raw ?? []) as unknown as RawStandingRow[]));
      setLoading(false);
    }

    load();
    const channel = supabase
      .channel(`division-standings:${division}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "standings", filter: `division_id=eq.${division}` },
        () => load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [divisionId]);

  return { ...data, loading };
}

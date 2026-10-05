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
    // A save rewrites the division's rows twice (the WOD, then overall), one
    // change event per row: refetch once after the burst, and apply only the
    // newest answer so a slow early one can't leave a half-updated table.
    let latest = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scheduleLoad = () => {
      clearTimeout(timer);
      timer = setTimeout(load, 250);
    };

    async function load() {
      const request = ++latest;
      const { data: raw } = await supabase
        .from("standings")
        .select(
          "wod_id, placement, points, athlete_id, team_id, athletes(first_name, last_name), teams(name), wods(id, name, created_at)",
        )
        .eq("division_id", division);
      if (cancelled || request !== latest) return;
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
        scheduleLoad,
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [divisionId]);

  return { ...data, loading };
}

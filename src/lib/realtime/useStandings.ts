"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/db/client";

export interface StandingsRow {
  placement: number | null;
  points: number | null;
  name: string;
}

/**
 * Live overall standings for a division (wod_id null = across all WODs).
 * Refetches whenever the `standings` table changes for this division, so a
 * result entered in Admin reaches the leaderboard overlay without a refresh.
 */
export function useStandings(divisionId: string | null) {
  const [rows, setRows] = useState<StandingsRow[]>([]);

  useEffect(() => {
    if (!divisionId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when there's no division to show
      setRows([]);
      return;
    }
    const division = divisionId; // narrowed to string for the async loader below
    const supabase = createClient();
    let cancelled = false;

    async function load() {
      const { data } = await supabase
        .from("standings")
        .select("placement, points, athletes(first_name, last_name), teams(name)")
        .eq("division_id", division)
        .is("wod_id", null)
        .order("placement", { ascending: true, nullsFirst: false });

      // See lib/db/queries.ts header comment: cast many-to-one embeds back to single objects.
      const rows = data as unknown as Array<{
        placement: number | null;
        points: number | null;
        athletes: { first_name: string; last_name: string } | null;
        teams: { name: string } | null;
      }> | null;

      if (!cancelled) {
        setRows(
          (rows ?? []).map((r) => ({
            placement: r.placement,
            points: r.points,
            name: r.athletes
              ? `${r.athletes.first_name} ${r.athletes.last_name}`
              : (r.teams?.name ?? "—"),
          })),
        );
      }
    }

    load();

    const channel = supabase
      .channel(`standings:${divisionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "standings",
          filter: `division_id=eq.${divisionId}`,
        },
        () => load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [divisionId]);

  return rows;
}

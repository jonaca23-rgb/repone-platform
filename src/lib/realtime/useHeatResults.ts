"use client";

import { useEffect, useId, useState } from "react";
import { createClient } from "@/lib/db/client";
import type { ResultValue } from "@/lib/scoring/formatResult";

export interface HeatResult {
  result: ResultValue;
  /** Place in this WOD for the division (null until standings are computed). */
  placement: number | null;
}

/**
 * Live results of one heat, keyed by athlete id, with each athlete's place in
 * that WOD for the heat's division. Refetches when the heat's results or the
 * division's standings change, so a score saved on the floor reaches the
 * "Score" graphic without a reload. Pass null to stop listening.
 */
export function useHeatResults(
  heat: { id: string; wodId: string; divisionId: string } | null,
): Map<string, HeatResult> {
  const [byAthlete, setByAthlete] = useState<Map<string, HeatResult>>(new Map());
  const instanceId = useId();
  const heatId = heat?.id ?? null;
  const wodId = heat?.wodId ?? null;
  const divisionId = heat?.divisionId ?? null;

  useEffect(() => {
    if (!heatId || !wodId || !divisionId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when there's no heat to show
      setByAthlete(new Map());
      return;
    }
    const supabase = createClient();
    let cancelled = false;

    async function load() {
      const [{ data: results }, { data: places }] = await Promise.all([
        supabase
          .from("results")
          .select("athlete_id, time_seconds, reps, load, points, capped, status")
          .eq("heat_id", heatId!),
        supabase
          .from("standings")
          .select("athlete_id, placement")
          .eq("division_id", divisionId!)
          .eq("wod_id", wodId!),
      ]);
      if (cancelled) return;
      const placeOf = new Map((places ?? []).map((p) => [p.athlete_id, p.placement]));
      const next = new Map<string, HeatResult>();
      for (const r of results ?? []) {
        if (!r.athlete_id) continue;
        next.set(r.athlete_id, {
          result: {
            time_seconds: r.time_seconds,
            reps: r.reps,
            load: r.load,
            points: r.points,
            capped: r.capped,
            status: r.status,
          },
          placement: placeOf.get(r.athlete_id) ?? null,
        });
      }
      setByAthlete(next);
    }

    void load();
    const channel = supabase
      .channel(`heat_results:${heatId}:${instanceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "results", filter: `heat_id=eq.${heatId}` },
        () => void load(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "standings",
          filter: `division_id=eq.${divisionId}`,
        },
        () => void load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [heatId, wodId, divisionId, instanceId]);

  return byAthlete;
}

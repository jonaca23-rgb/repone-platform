"use client";

import { useEffect, useId, useState } from "react";
import { createClient } from "@/lib/db/client";
import type { Database } from "@/lib/db/database.types";

type BroadcastStateRow = Database["public"]["Tables"]["broadcast_state"]["Row"];

/**
 * Subscribes to Realtime changes on the single broadcast_state row for a
 * floor. This is the ONE channel every overlay and the dashboard read from —
 * no client computes its own copy of "what's live right now."
 *
 * - The channel name is unique per hook instance: realtime-js reuses a
 *   channel with the same topic, so two components on one page (or React
 *   StrictMode's double mount) would otherwise share one, and the first to
 *   unmount would remove the other's feed.
 * - Every (re)subscribe re-reads the row, so changes missed while the
 *   connection was down are picked up instead of waiting for the next one.
 * - A DELETE (the floor was removed) keeps the last known state rather than
 *   replacing it with an empty object.
 */
export function useBroadcastState(floorId: string, initial: BroadcastStateRow | null) {
  const [state, setState] = useState<BroadcastStateRow | null>(initial);
  const [connected, setConnected] = useState(false);
  const instanceId = useId();

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const refetch = async () => {
      const { data } = await supabase
        .from("broadcast_state")
        .select("*")
        .eq("floor_id", floorId)
        .maybeSingle();
      if (!cancelled && data) setState(data as BroadcastStateRow);
    };

    const channel = supabase
      .channel(`broadcast_state:${floorId}:${instanceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "broadcast_state",
          filter: `floor_id=eq.${floorId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          setState(payload.new as BroadcastStateRow);
        },
      )
      .subscribe((status) => {
        if (cancelled) return;
        setConnected(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") void refetch();
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [floorId, instanceId]);

  return { state, connected };
}

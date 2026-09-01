"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/db/client";
import type { Database } from "@/lib/db/database.types";

type BroadcastStateRow = Database["public"]["Tables"]["broadcast_state"]["Row"];

/**
 * Subscribes to Realtime changes on the single broadcast_state row for a
 * floor. This is the ONE channel every overlay and the dashboard read from —
 * no client computes its own copy of "what's live right now."
 */
export function useBroadcastState(floorId: string, initial: BroadcastStateRow | null) {
  const [state, setState] = useState<BroadcastStateRow | null>(initial);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`broadcast_state:${floorId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "broadcast_state", filter: `floor_id=eq.${floorId}` },
        (payload) => {
          setState(payload.new as BroadcastStateRow);
        }
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [floorId]);

  return { state, connected };
}

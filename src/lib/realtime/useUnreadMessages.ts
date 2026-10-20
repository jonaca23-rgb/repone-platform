"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/db/client";

/**
 * Live "you have new messages" badge count for a signed-in user (athlete or
 * staff). Re-queries the unread count on any insert/update touching this
 * user's received messages rather than trying to track deltas locally — a
 * bulk "mark thread read" update fires one Realtime event per row, and
 * refetching keeps this self-correcting instead of drifting out of sync.
 */
export function useUnreadMessages(userId: string, initialCount: number) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    const supabase = createClient();

    const refetch = async () => {
      const { count: unread } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", userId)
        .is("read_at", null);
      setCount(unread ?? 0);
    };

    const channel = supabase
      .channel(`messages:recipient:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `recipient_id=eq.${userId}` },
        refetch,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return count;
}

"use client";

import { useRefreshOnChanges } from "@/lib/realtime/useRefreshOnChanges";

/**
 * Re-renders the open thread when a message to this user arrives: the server
 * renders the new message and marks it read, and the thread scrolls to it.
 */
export function ThreadLiveRefresh({ myUserId }: { myUserId: string }) {
  useRefreshOnChanges([{ table: "messages", filter: `recipient_id=eq.${myUserId}` }]);
  return null;
}

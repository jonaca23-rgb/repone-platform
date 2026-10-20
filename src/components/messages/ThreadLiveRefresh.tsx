"use client";

import { useRefreshOnChanges } from "@/lib/realtime/useRefreshOnChanges";

/**
 * Re-renders the open thread when a message to or from this user is added: the server
 * renders the new message and marks it read, and the thread scrolls to it.
 */
export function ThreadLiveRefresh({ myUserId }: { myUserId: string }) {
  // New messages only: marking a thread read UPDATEs the same rows, and
  // listening to that would refresh twice per message. Messages I send from
  // another device count too.
  useRefreshOnChanges([
    { table: "messages", event: "INSERT", filter: `recipient_id=eq.${myUserId}` },
    { table: "messages", event: "INSERT", filter: `sender_id=eq.${myUserId}` },
  ]);
  return null;
}

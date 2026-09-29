"use client";

import Link from "next/link";
import { useUnreadMessages } from "@/lib/realtime/useUnreadMessages";

/**
 * Nav link + live unread-count badge, shared by the athlete portal header
 * and the admin nav. `initialUnread` comes from a server-rendered count so
 * the badge is correct on first paint; the Realtime subscription in
 * useUnreadMessages keeps it live after that with no page refresh needed.
 */
export function MessagesNavLink({
  href,
  userId,
  initialUnread,
}: {
  href: string;
  userId: string;
  initialUnread: number;
}) {
  const unread = useUnreadMessages(userId, initialUnread);

  return (
    <Link href={href} className="relative hover:text-white">
      Messages
      {unread > 0 ? (
        <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-repone-red px-1.5 py-0.5 text-[10px] font-bold text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );
}

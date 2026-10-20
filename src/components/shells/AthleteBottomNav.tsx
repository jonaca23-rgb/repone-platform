"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, MessageSquare, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUnreadMessages } from "@/lib/realtime/useUnreadMessages";

const ITEMS: Array<{ href: string; label: string; icon: LucideIcon; messages?: boolean }> = [
  { href: "/athlete", label: "Home", icon: House },
  { href: "/athlete/directory", label: "Athletes", icon: Users },
  { href: "/athlete/messages", label: "Messages", icon: MessageSquare, messages: true },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/athlete"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

function unreadLabel(unread: number): string {
  return unread > 0 ? `, ${unread > 99 ? "99+" : unread} unread` : "";
}

/**
 * The athlete's three destinations. On phones a fixed tab bar at the bottom
 * (thumb reach, clear of the home indicator); from md up the same links sit
 * inline in the header, which is where this renders. One component draws
 * both so there is one live unread subscription (useUnreadMessages opens a
 * Realtime channel per user, and a second subscriber to that topic would fail).
 */
export function AthleteBottomNav({ unreadCount, userId }: { unreadCount: number; userId: string }) {
  const pathname = usePathname();
  const unread = useUnreadMessages(userId, unreadCount);

  return (
    <>
      <nav aria-label="Athlete" className="hidden items-center gap-1 md:flex">
        {ITEMS.map(({ href, label, icon: Icon, messages }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden",
                active
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
              {messages && unread > 0 ? (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
                  <span aria-hidden>{unread > 99 ? "99+" : unread}</span>
                  <span className="sr-only">{unreadLabel(unread)}</span>
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <nav
        aria-label="Athlete"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="grid grid-cols-3">
          {ITEMS.map(({ href, label, icon: Icon, messages }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden focus-visible:ring-inset",
                    active ? "text-brand-text" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="relative">
                    <Icon className="size-6" aria-hidden />
                    {messages && unread > 0 ? (
                      <span
                        aria-hidden
                        className="absolute -top-0.5 -right-1 size-2.5 rounded-full bg-primary ring-2 ring-card"
                      />
                    ) : null}
                  </span>
                  <span>
                    {label}
                    {messages ? <span className="sr-only">{unreadLabel(unread)}</span> : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

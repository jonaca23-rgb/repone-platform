"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useLayoutEffect, useState } from "react";
import {
  BadgeDollarSign,
  CalendarDays,
  Dumbbell,
  FileText,
  LayoutGrid,
  ListOrdered,
  MapPin,
  MessageSquare,
  Receipt,
  Route,
  ScanLine,
  ShieldCheck,
  Tags,
  UserCog,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { useUnreadMessages } from "@/lib/realtime/useUnreadMessages";

export type AdminEvent = { id: string; name: string };

// The event an /admin/events/[eventId] page is under. The event layout sits
// inside the shell's content, not around the sidebar, so it can't wrap the
// sidebar in a context of its own: the shell holds the slot (AdminEventRoot)
// and the layout fills it (AdminEventProvider) while it is mounted.
const AdminEventSlot = createContext<{
  event: AdminEvent | null;
  setEvent: (update: (current: AdminEvent | null) => AdminEvent | null) => void;
} | null>(null);

export function AdminEventRoot({ children }: { children: React.ReactNode }) {
  const [event, setEvent] = useState<AdminEvent | null>(null);
  return <AdminEventSlot.Provider value={{ event, setEvent }}>{children}</AdminEventSlot.Provider>;
}

/** Rendered by the event layout: shows `event`'s group in the sidebar while its pages are open. */
export function AdminEventProvider({
  event,
  children,
}: {
  event: AdminEvent;
  children: React.ReactNode;
}) {
  const slot = useContext(AdminEventSlot);
  const setEvent = slot?.setEvent;
  const { id, name } = event;
  useLayoutEffect(() => {
    if (!setEvent) return;
    setEvent(() => ({ id, name }));
    return () => setEvent((current) => (current?.id === id ? null : current));
  }, [setEvent, id, name]);
  return children;
}

type NavItem = { href: string; label: string; icon: LucideIcon };

const ORG_ITEMS: NavItem[] = [
  { href: "/admin", label: "Events", icon: CalendarDays },
  { href: "/admin/circuits", label: "Circuits", icon: Route },
  { href: "/admin/athletes", label: "Athletes", icon: Users },
  { href: "/admin/checkin", label: "Check-In", icon: ScanLine },
  { href: "/admin/teams", label: "Teams", icon: UsersRound },
  { href: "/admin/sponsors", label: "Sponsors", icon: BadgeDollarSign },
];
const MEMBERS: NavItem = { href: "/admin/team", label: "Members", icon: ShieldCheck };
const MESSAGES: NavItem = { href: "/admin/messages", label: "Messages", icon: MessageSquare };

const EVENT_ITEMS: { slug: string; label: string; icon: LucideIcon }[] = [
  { slug: "", label: "Overview", icon: LayoutGrid },
  { slug: "venues", label: "Venues", icon: MapPin },
  { slug: "divisions", label: "Divisions", icon: Tags },
  { slug: "athletes", label: "Athletes", icon: Users },
  { slug: "wods", label: "WODs", icon: Dumbbell },
  { slug: "heats", label: "Heats", icon: ListOrdered },
  { slug: "staff", label: "Staff", icon: UserCog },
  { slug: "fees", label: "Fees", icon: Receipt },
  { slug: "payments", label: "Payments", icon: Wallet },
  { slug: "statement", label: "Statement", icon: FileText },
];

const within = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

/** Which sidebar link is the current page. Exported for tests. */
export function activeHref(pathname: string, eventId: string | null): string | null {
  if (eventId) {
    const base = `/admin/events/${eventId}`;
    if (pathname === base) return base;
    for (const item of EVENT_ITEMS) {
      if (item.slug && within(pathname, `${base}/${item.slug}`)) return `${base}/${item.slug}`;
    }
  }
  if (pathname === "/admin" || within(pathname, "/admin/events")) return "/admin";
  for (const item of [...ORG_ITEMS, MEMBERS, MESSAGES]) {
    if (item.href !== "/admin" && within(pathname, item.href)) return item.href;
  }
  return null;
}

/** The event id in an /admin/events/[eventId]/… path, or null. */
export function eventIdFromPath(pathname: string): string | null {
  return /^\/admin\/events\/([^/]+)/.exec(pathname)?.[1] ?? null;
}

function NavLink({ item, active, badge }: { item: NavItem; active: boolean; badge?: number }) {
  const { setOpenMobile } = useSidebar();
  const Icon = item.icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={item.label}
        className="data-[active=true]:shadow-[inset_3px_0_0_var(--primary)]"
      >
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          onClick={() => setOpenMobile(false)}
        >
          <Icon aria-hidden />
          <span>
            {item.label}
            {badge ? <span className="sr-only">, {badge} unread</span> : null}
          </span>
        </Link>
      </SidebarMenuButton>
      {badge ? (
        <SidebarMenuBadge aria-hidden className="rounded-full bg-primary text-primary-foreground">
          {badge > 99 ? "99+" : badge}
        </SidebarMenuBadge>
      ) : null}
    </SidebarMenuItem>
  );
}

export function AdminSidebar({
  unreadCount,
  canManageMembers,
  event,
  menu,
}: {
  unreadCount: number;
  canManageMembers: boolean;
  event: AdminEvent | null;
  menu: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = activeHref(pathname, event?.id ?? null);
  const orgItems = [...ORG_ITEMS, ...(canManageMembers ? [MEMBERS] : [])];

  return (
    <Sidebar collapsible="icon" className="border-border">
      <SidebarHeader>
        <Link
          href="/"
          className="flex h-10 items-center rounded-md px-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden group-data-[collapsible=icon]:px-0"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- local static asset in public/, not optimizable-domain content */}
          <img
            src="/repone-logo.png"
            alt="RepOne"
            width={472}
            height={240}
            className="h-8 w-auto group-data-[collapsible=icon]:h-auto group-data-[collapsible=icon]:w-8"
          />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Organization</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {orgItems.map((item) => (
                <NavLink key={item.href} item={item} active={active === item.href} />
              ))}
              <NavLink item={MESSAGES} active={active === MESSAGES.href} badge={unreadCount} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {event ? (
          <SidebarGroup>
            <SidebarGroupLabel className="truncate">{event.name}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {EVENT_ITEMS.map(({ slug, label, icon }) => {
                  const href = `/admin/events/${event.id}${slug ? `/${slug}` : ""}`;
                  return (
                    <NavLink key={href} item={{ href, label, icon }} active={active === href} />
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>
      <SidebarFooter className="border-t border-border">
        <div className="min-w-0 overflow-hidden [&_[data-slot=button]]:w-full [&_[data-slot=button]]:justify-start group-data-[collapsible=icon]:[&_[data-slot=button]]:px-0">
          {menu}
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

/**
 * AdminSidebar wired to the shell: the event from the event layout (or, until
 * it mounts, the id in the URL, so the group is in the server render) and the
 * live unread count.
 */
export function ConnectedAdminSidebar({
  userId,
  unreadCount,
  canManageMembers,
  menu,
}: {
  userId: string;
  unreadCount: number;
  canManageMembers: boolean;
  menu: React.ReactNode;
}) {
  const pathname = usePathname();
  const slot = useContext(AdminEventSlot);
  const unread = useUnreadMessages(userId, unreadCount);
  const idInPath = eventIdFromPath(pathname);
  const event =
    slot?.event && slot.event.id === idInPath
      ? slot.event
      : idInPath
        ? { id: idInPath, name: "Event" }
        : null;
  return (
    <AdminSidebar
      unreadCount={unread}
      canManageMembers={canManageMembers}
      event={event}
      menu={menu}
    />
  );
}

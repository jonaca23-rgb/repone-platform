"use client";

import Link from "next/link";
import { useTransition } from "react";
import {
  ChevronDown,
  ClipboardList,
  House,
  LayoutDashboard,
  LogOut,
  Mic,
  Radio,
  User,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth/actions";
import { leaveAfterIdentityChange } from "@/lib/auth/identityChange";
import type { MenuItem } from "./moduleMenuItems";

const ICONS = {
  home: House,
  admin: LayoutDashboard,
  producer: Radio,
  scorekeeper: ClipboardList,
  commentator: Mic,
  athlete: User,
} as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.trim().slice(0, 2);
  return letters.toUpperCase();
}

/** Module switcher + account menu. Closes on Escape, keyboard navigable (Radix). */
export function ModuleMenuView({
  name,
  email,
  items,
  align = "end",
  side = "bottom",
}: {
  name: string;
  email: string;
  items: MenuItem[];
  align?: "start" | "end";
  side?: "top" | "bottom";
}) {
  const [pending, startTransition] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2">
          <Avatar size="sm">
            <AvatarFallback>{initials(name)}</AvatarFallback>
          </Avatar>
          <span className="max-w-40 truncate">{name}</span>
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} side={side} className="min-w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate text-foreground">{name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          return (
            <DropdownMenuItem key={item.href} asChild>
              <Link href={item.href} aria-current={item.current ? "page" : undefined}>
                <Icon aria-hidden />
                <span className="flex flex-col">
                  <span className={item.current ? "font-semibold" : undefined}>{item.label}</span>
                  {item.detail ? (
                    <span className="text-xs text-muted-foreground">{item.detail}</span>
                  ) : null}
                </span>
              </Link>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={pending}
          onSelect={(e) => {
            e.preventDefault();
            startTransition(async () => {
              await signOut();
              leaveAfterIdentityChange("/login");
            });
          }}
        >
          <LogOut aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { ClipboardList, House, LayoutDashboard, Mic, Radio, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ModuleKind } from "@/lib/auth/modules";

/** The lucide icon for each module (and Home), shared by the module menu and the start page. */
export const MODULE_ICONS: Record<ModuleKind | "home", LucideIcon> = {
  home: House,
  admin: LayoutDashboard,
  producer: Radio,
  scorekeeper: ClipboardList,
  commentator: Mic,
  athlete: User,
};

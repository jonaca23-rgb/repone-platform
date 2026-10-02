import { getAuthSession } from "@/lib/auth/session";
import { userModules } from "@/lib/auth/userModules";
import type { ModuleKind } from "@/lib/auth/modules";
import { moduleMenuItems } from "./moduleMenuItems";
import { ModuleMenuView } from "./ModuleMenuView";

/** Module switcher + account menu, shared by every shell. */
export async function ModuleMenu({
  current,
  align = "end",
  side = "bottom",
}: {
  current: ModuleKind | null;
  align?: "start" | "end";
  side?: "top" | "bottom";
}) {
  const [session, modules] = await Promise.all([getAuthSession(), userModules()]);
  if (!session) return null;
  return (
    <ModuleMenuView
      name={session.name || session.email}
      email={session.email}
      items={moduleMenuItems(modules, current)}
      align={align}
      side={side}
    />
  );
}
export { ModuleMenuView } from "./ModuleMenuView";

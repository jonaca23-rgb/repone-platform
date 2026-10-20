import type { Module, ModuleKind } from "@/lib/auth/modules";

export interface MenuItem {
  href: string;
  label: string;
  detail?: string;
  icon: ModuleKind | "home";
  current: boolean;
}

/** Home, then the person's modules (lib/auth/modules order), the current one marked. */
export function moduleMenuItems(modules: Module[], currentKind: ModuleKind | null): MenuItem[] {
  return [
    { href: "/", label: "Home", icon: "home", current: false },
    ...modules.map((m) => ({
      href: m.href,
      label: m.label,
      detail: m.detail,
      icon: m.kind,
      current: m.kind === currentKind,
    })),
  ];
}

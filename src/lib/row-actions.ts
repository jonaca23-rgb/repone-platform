import type { LucideIcon } from "lucide-react";

/**
 * One thing a row's actions can do: open a link, or run something (a dialog,
 * a mutation). A blocked action stays listed, disabled, with its hint.
 */
export type RowAction = {
  label: string;
  icon?: LucideIcon;
  /** A place to go. */
  href?: string;
  /** A thing to do: opens a dialog or runs a mutation. */
  onSelect?: () => void;
  disabled?: boolean;
  /** A second muted line, e.g. why it is disabled. */
  hint?: string;
};

/**
 * A row's actions, in three groups. The primary one is a visible button and
 * is never destructive; everything else sits behind "⋯", destructive last.
 */
export type RowActionSet = {
  primary?: RowAction;
  secondary?: RowAction[];
  destructive?: RowAction[];
};

/**
 * Pure: what `RowActions` will draw, for tests. The menu is the labels in
 * order, with "—" marking the separator between the safe and destructive
 * groups — present only when both groups are non-empty.
 */
export function rowActionLayout(set: RowActionSet): { button: string | null; menu: string[] } {
  const secondary = set.secondary ?? [];
  const destructive = set.destructive ?? [];
  const menu = [
    ...secondary.map((action) => action.label),
    ...(secondary.length > 0 && destructive.length > 0 ? ["—"] : []),
    ...destructive.map((action) => action.label),
  ];
  return { button: set.primary?.label ?? null, menu };
}

"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";

import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { RowAction, RowActionSet } from "@/lib/row-actions";
import { cn } from "@/lib/utils";

export type { RowAction, RowActionSet } from "@/lib/row-actions";
export { rowActionLayout } from "@/lib/row-actions";

/**
 * A row's actions, laid out one way everywhere: the main action as a visible
 * button, everything else behind "⋯", destructive actions last and set apart
 * by a separator. Replaces the ad-hoc menus a list used to build for itself.
 *
 * `rowActionLayout` is the pure shape this draws — test against that, not
 * against this component's markup.
 */
export function RowActions({
  label,
  compact,
  primary,
  secondary = [],
  destructive = [],
}: RowActionSet & { label: string; compact?: boolean }) {
  const hasMenu = secondary.length > 0 || destructive.length > 0;
  if (!primary && !hasMenu) return null;

  // One line, never wrapped: the "⋯" stays beside the primary button instead
  // of being stranded on a line of its own below it. On a phone, a row with a
  // primary action takes the whole width its parent gives it (the line under
  // the name, in a list whose row wraps), and the button fills what the "⋯"
  // leaves. `data-row-primary` lets a table lay that line under the row's
  // first cell (components/data-table/data-table.tsx).
  return (
    <div
      data-slot="row-actions"
      data-row-primary={primary ? "" : undefined}
      className={cn("flex items-center justify-end gap-2", primary && "max-md:w-full")}
    >
      {primary ? <PrimaryButton action={primary} /> : null}
      {hasMenu ? (
        <RowMenu label={label} compact={compact}>
          {secondary.map((action) => (
            <MenuAction key={action.label} action={action} />
          ))}
          {secondary.length > 0 && destructive.length > 0 ? <DropdownMenuSeparator /> : null}
          {destructive.map((action) => (
            <MenuAction key={action.label} action={action} destructive />
          ))}
        </RowMenu>
      ) : null}
    </div>
  );
}

/**
 * The visible button: `lg` size (this app's 44px thumb size, filling the
 * line beside "⋯") below `md`, so it sits under the row's name on a phone at
 * a real tap target rather than the brief's `default` (32px) — the app-wide ≥44px
 * phone-target constraint binds over the size named in the row-actions
 * design — and `sm` size at `md` and up.
 *
 * Two real `Button`s, each at its own named size, rather than one size with
 * hand-copied classes imitating the other: `size` drives more than height —
 * icon sizing and the icon's own padding come from it too — and that should
 * track `buttonVariants`, not a copy of it that drifts when it changes.
 * `display: none` (Tailwind's `hidden`) removes the other one from both the
 * focus order and the accessibility tree, so exactly one is ever reachable.
 */
function PrimaryButton({ action }: { action: RowAction }) {
  const { icon: Icon, label, href, onSelect, disabled = false, hint } = action;
  const content = (
    <>
      {Icon ? <Icon /> : null}
      {label}
    </>
  );
  return (
    <>
      <SizedPrimaryButton
        size="lg"
        className="flex-1 md:hidden"
        href={href}
        onSelect={onSelect}
        disabled={disabled}
        hint={hint}
      >
        {content}
      </SizedPrimaryButton>
      <SizedPrimaryButton
        size="sm"
        className="hidden md:inline-flex"
        href={href}
        onSelect={onSelect}
        disabled={disabled}
        hint={hint}
      >
        {content}
      </SizedPrimaryButton>
    </>
  );
}

function SizedPrimaryButton({
  size,
  className,
  href,
  onSelect,
  disabled,
  hint,
  children,
}: {
  size: "lg" | "sm";
  className: string;
  href?: string;
  onSelect?: () => void;
  disabled: boolean;
  hint?: string;
  children: ReactNode;
}) {
  // A disabled link would still navigate: an anchor has no native disabled
  // behaviour. Fall back to a real disabled button instead of one that looks
  // blocked but isn't.
  if (href && !disabled) {
    return (
      <Button asChild variant="outline" size={size} className={className} title={hint}>
        <Link href={href}>{children}</Link>
      </Button>
    );
  }
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      className={className}
      disabled={disabled}
      onClick={onSelect}
      title={hint}
    >
      {children}
    </Button>
  );
}

/**
 * The "⋯" and the menu it opens. Non-modal: an item that opens a dialog hands
 * focus to that dialog rather than back to a menu that is closing.
 */
function RowMenu({
  label,
  compact = false,
  children,
}: {
  /** Names the row, for the button: "Actions for Heat 3". */
  label: string;
  /** A smaller button, for a row shown as a chip. */
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? "icon-sm" : "icon-lg"}
          className="text-muted-foreground shrink-0"
          aria-label={label}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * One item in the menu: a place to go or a thing to do. A destructive one
 * reads in the destructive colour; a blocked one stays listed, disabled, with
 * its hint as a second line saying why.
 */
function MenuAction({ action, destructive = false }: { action: RowAction; destructive?: boolean }) {
  const { icon: Icon, label, href, onSelect, disabled = false, hint } = action;
  const variant = destructive ? "destructive" : "default";
  const body = (
    <>
      {Icon ? <Icon /> : null}
      <span className="grid gap-0.5">
        <span>{label}</span>
        {hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
      </span>
    </>
  );

  if (href) {
    return (
      <DropdownMenuItem asChild disabled={disabled} variant={variant}>
        <Link href={href}>{body}</Link>
      </DropdownMenuItem>
    );
  }
  return (
    <DropdownMenuItem disabled={disabled} variant={variant} onSelect={onSelect}>
      {body}
    </DropdownMenuItem>
  );
}

/**
 * Which of a row's dialogs is open. The dialogs live outside the menu — a
 * menu item only opens one — so the menu can close without taking the dialog
 * with it.
 *
 *   const dialogs = useEntityDialogs<"edit" | "delete">();
 *   <RowActions secondary={[{ label: "Edit", onSelect: dialogs.show("edit") }]} … />
 *   <FormDialog {...dialogs.props("edit")} …>
 *
 * `initial` opens one on arrival, for a link that leads straight to it.
 */
export function useEntityDialogs<Key extends string>(initial: Key | null = null) {
  const [open, setOpen] = useState<Key | null>(initial);
  return {
    show: (key: Key) => () => setOpen(key),
    props: (key: Key) => ({
      open: open === key,
      onOpenChange: (next: boolean) => setOpen(next ? key : null),
    }),
  };
}

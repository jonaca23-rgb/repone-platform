"use client";

import { useState } from "react";

import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";

/**
 * A form behind a button: the one shape every create and edit in the app takes.
 *
 * Owns its open state unless given `open`/`onOpenChange`, and hands the form a
 * `close` to call once it has saved. Closing unmounts the form, so reopening
 * starts from the record's current values rather than a half-typed draft.
 */
export function FormDialog({
  trigger,
  title,
  description,
  open: controlledOpen,
  onOpenChange,
  children,
}: {
  /** The button that opens it. Omit when the dialog is opened through `open`. */
  trigger?: React.ReactElement;
  title: string;
  description?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: (close: () => void) => React.ReactNode;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      {trigger ? <ResponsiveDialogTrigger>{trigger}</ResponsiveDialogTrigger> : null}
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{title}</ResponsiveDialogTitle>
          {description ? (
            <ResponsiveDialogDescription>{description}</ResponsiveDialogDescription>
          ) : null}
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody>{open ? children(() => setOpen(false)) : null}</ResponsiveDialogBody>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

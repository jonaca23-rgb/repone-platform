"use client";

import { useRef, useState, useTransition } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { hrefOf, isFailure } from "@/lib/action-result";

/**
 * The only way to run a destructive or hard-to-undo action: it names what is
 * affected and what happens, and runs the action once, after the person
 * confirms. Failures surface as a toast; the dialog stays open to retry.
 *
 * Without a `trigger`, pass `open` and `onOpenChange` to raise it from code
 * (e.g. a heat picker asking before it discards unsaved lanes).
 */
export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
  variant = "destructive",
  triggerVariant = "ghost",
  triggerSize = "sm",
  triggerClassName,
  open: openProp,
  onOpenChange,
}: {
  trigger?: React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<unknown>;
  variant?: "destructive" | "default";
  triggerVariant?: "default" | "destructive" | "ghost" | "outline" | "secondary" | "link";
  triggerSize?: "sm" | "default" | "touch";
  /** Layout or size on the trigger, e.g. min-h-16 on a live control. */
  triggerClassName?: string;
  /** Controlled mode, for a dialog with no trigger of its own. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [innerOpen, setInnerOpen] = useState(false);
  const open = openProp ?? innerOpen;
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setInnerOpen(next);
    onOpenChange?.(next);
  };
  const [pending, start] = useTransition();
  const inFlight = useRef(false);
  const router = useRouter();

  function handleConfirm(e: React.MouseEvent) {
    e.preventDefault(); // keep the dialog open until the action settles
    if (pending || inFlight.current) return;
    inFlight.current = true;
    start(async () => {
      try {
        const result = await onConfirm();
        if (isFailure(result)) {
          toast.error(result.message);
          return; // stays open to retry
        }
        setOpen(false);
        const words = (result as { message?: unknown } | null | undefined)?.message;
        if (typeof words === "string") toast.success(words);
        const href = hrefOf(result);
        if (href) router.push(href);
      } catch (err) {
        // A redirect (Delete event → /admin) or notFound is Next's to handle, not a failure.
        unstable_rethrow(err);
        toast.error(err instanceof Error ? err.message : "That didn't go through. Try again.");
      } finally {
        inFlight.current = false;
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      {trigger !== undefined ? (
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant={triggerVariant}
            size={triggerSize}
            className={triggerClassName}
          >
            {trigger}
          </Button>
        </AlertDialogTrigger>
      ) : null}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={pending}
            className={
              variant === "destructive"
                ? "bg-destructive-fill text-primary-foreground hover:bg-destructive-fill/90"
                : undefined
            }
          >
            {pending ? "Working…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

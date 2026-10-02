"use client";

import { useRef, useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
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

/**
 * The only way to run a destructive or hard-to-undo action: it names what is
 * affected and what happens, and runs the action once, after the person
 * confirms. Failures surface as a toast; the dialog stays open to retry.
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
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<unknown>;
  variant?: "destructive" | "default";
  triggerVariant?: "destructive" | "ghost" | "outline" | "link";
  triggerSize?: "sm" | "default" | "touch";
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const inFlight = useRef(false);

  function handleConfirm(e: React.MouseEvent) {
    e.preventDefault(); // keep the dialog open until the action settles
    if (pending || inFlight.current) return;
    inFlight.current = true;
    start(async () => {
      try {
        await onConfirm();
        setOpen(false);
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
      <AlertDialogTrigger asChild>
        <Button type="button" variant={triggerVariant} size={triggerSize}>
          {trigger}
        </Button>
      </AlertDialogTrigger>
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

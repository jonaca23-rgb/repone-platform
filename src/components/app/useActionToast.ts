"use client";
import { toast } from "sonner";

/** Runs a server action and reports it: the label on success, the error otherwise. */
export function useActionToast() {
  return async (label: string, action: () => Promise<unknown>) => {
    try {
      await action();
      toast.success(label);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That didn't go through. Try again.");
    }
  };
}

"use client";

import { useId, useOptimistic, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { isFailure } from "@/lib/action-result";

/**
 * An on/off setting saved as soon as it flips (sponsor active, fee active).
 * `action` gets the new value; a failure flips it back and says why.
 */
export function ActionSwitch({
  checked,
  action,
  label,
  onLabel = "Active",
  offLabel = "Inactive",
}: {
  checked: boolean;
  action: (next: boolean) => Promise<unknown>;
  /** What is being switched, for screen readers ("Hoka active"). */
  label: string;
  onLabel?: string;
  offLabel?: string;
}) {
  const id = useId();
  const [pending, start] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(checked);

  return (
    <div className="flex items-center gap-2">
      <Switch
        id={id}
        checked={optimistic}
        disabled={pending}
        aria-label={label}
        onCheckedChange={(next) =>
          start(async () => {
            setOptimistic(next);
            try {
              const result = await action(next);
              if (isFailure(result)) {
                toast.error(result.message);
                setOptimistic(checked);
              }
            } catch (err) {
              unstable_rethrow(err);
              toast.error(
                err instanceof Error ? err.message : "That didn't go through. Try again.",
              );
            }
          })
        }
      />
      <Label
        htmlFor={id}
        // On a phone the switch alone shows the state, so a table row keeps its width.
        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground max-md:sr-only"
      >
        {optimistic ? onLabel : offLabel}
      </Label>
    </div>
  );
}

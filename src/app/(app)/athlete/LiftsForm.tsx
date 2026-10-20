"use client";

import type { LiftName } from "@/lib/constants/lifts";
import { saveMyLifts } from "@/lib/actions/myLifts";
import { fieldErrorsOf, useServerAction } from "@/lib/use-server-action";
import { FormAlert } from "@/components/app/FormAlert";
import { FormField } from "@/components/app/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** The athlete's own PRs and run times; blank fields are left as they are. */
export function LiftsForm({
  lifts,
}: {
  lifts: Array<{ lift: LiftName; label: string; timeLift: boolean; defaultValue: string }>;
}) {
  const save = useServerAction(saveMyLifts, { success: "Lifts saved.", toastErrors: false });
  const errors = fieldErrorsOf(save.error);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(new FormData(e.currentTarget));
      }}
      className="grid grid-cols-2 gap-3 sm:grid-cols-3"
    >
      {lifts.map((l) => (
        <FormField
          key={l.lift}
          label={`${l.label} ${l.timeLift ? "(mm:ss)" : "(lbs)"}`}
          name={l.lift}
          errors={errors?.[l.lift]}
        >
          {(control) =>
            l.timeLift ? (
              <Input
                {...control}
                type="text"
                // Text keypad: a phone's decimal keypad has no colon.
                inputMode="text"
                placeholder="21:30"
                defaultValue={l.defaultValue}
                className="h-11"
              />
            ) : (
              <Input
                {...control}
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0"
                defaultValue={l.defaultValue}
                className="h-11"
              />
            )
          }
        </FormField>
      ))}
      <div className="col-span-full flex flex-col gap-2">
        <FormAlert error={save.error} />
        <Button
          type="submit"
          size="touch"
          disabled={save.isPending}
          className="mt-2 w-full sm:w-fit"
        >
          {save.isPending ? "Saving…" : "Save Lifts"}
        </Button>
      </div>
    </form>
  );
}

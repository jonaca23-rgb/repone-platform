"use client";

import { saveAthleteLifts } from "@/lib/actions/athletes";
import { LIFT_LABELS, LIFT_NAMES, isTimeLift, type LiftName } from "@/lib/constants/lifts";
import { fieldErrorsOf, useServerAction } from "@/lib/use-server-action";
import { FormAlert } from "@/components/app/FormAlert";
import { FormField } from "@/components/app/FormField";
import { SubmitButton } from "@/components/app/SubmitButton";
import { Input } from "@/components/ui/input";

/** Every basic lift and run time in one form; blank fields are left as they are. */
export function LiftsForm({
  athleteId,
  values,
}: {
  athleteId: string;
  /** Each lift's current value as the field shows it: lbs, or mm:ss for runs. */
  values: Partial<Record<LiftName, string>>;
}) {
  const save = useServerAction((fd: FormData) => saveAthleteLifts(athleteId, fd), {
    success: "Lifts saved",
    toastErrors: false,
  });
  const errors = fieldErrorsOf(save.error);
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(new FormData(e.currentTarget));
      }}
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {LIFT_NAMES.map((lift) =>
          isTimeLift(lift) ? (
            <FormField
              key={lift}
              label={`${LIFT_LABELS[lift]} (mm:ss)`}
              name={lift}
              errors={errors?.[lift]}
            >
              {(c) => (
                <Input
                  {...c}
                  inputMode="text"
                  pattern="[0-9]+:[0-5]?[0-9](\.[0-9]+)?|[0-9]+(\.[0-9]+)?"
                  placeholder="21:30"
                  defaultValue={values[lift] ?? ""}
                />
              )}
            </FormField>
          ) : (
            <FormField
              key={lift}
              label={`${LIFT_LABELS[lift]} (lbs)`}
              name={lift}
              errors={errors?.[lift]}
            >
              {(c) => (
                <Input
                  {...c}
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  min={0}
                  defaultValue={values[lift] ?? ""}
                />
              )}
            </FormField>
          ),
        )}
      </div>
      <FormAlert error={save.error} />
      <SubmitButton pending={save.isPending} pendingLabel="Saving…">
        Save lifts
      </SubmitButton>
    </form>
  );
}

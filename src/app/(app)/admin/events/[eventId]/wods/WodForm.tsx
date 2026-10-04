"use client";

import type { ActionResult } from "@/lib/action-result";
import { fieldErrorsOf, useServerAction } from "@/lib/use-server-action";
import { FormAlert } from "@/components/app/FormAlert";
import { FormField } from "@/components/app/FormField";
import { SubmitButton } from "@/components/app/SubmitButton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SCORING_TYPES, TIEBREAKS } from "./wodOptions";

export type WodValues = {
  name: string;
  scoring_type: string;
  time_cap_seconds: number | null;
  tiebreak_type: string;
  description: string | null;
  rules: string | null;
};

/** A WOD's fields, for adding one and editing one. */
export function WodForm({
  action,
  values,
  submitLabel,
  pendingLabel,
  success,
  close,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  values?: WodValues;
  submitLabel: string;
  pendingLabel: string;
  success: string;
  close: () => void;
}) {
  const save = useServerAction(action, { success, toastErrors: false, onSuccess: close });
  const errors = fieldErrorsOf(save.error);
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(new FormData(e.currentTarget));
      }}
    >
      <FormField label="Name" name="name" errors={errors?.name}>
        {(c) => <Input {...c} required placeholder="WOD 2" defaultValue={values?.name} />}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Scoring type" name="scoring_type" errors={errors?.scoring_type}>
          {({ name, ...c }) => (
            <Select name={name} defaultValue={values?.scoring_type ?? "for_time"}>
              <SelectTrigger {...c} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCORING_TYPES.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
        <FormField label="Tie-break" name="tiebreak_type" errors={errors?.tiebreak_type}>
          {({ name, ...c }) => (
            <Select name={name} defaultValue={values?.tiebreak_type ?? "none"}>
              <SelectTrigger {...c} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIEBREAKS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
      </div>
      <FormField
        label="Time cap (minutes)"
        name="time_cap_minutes"
        errors={errors?.time_cap_minutes}
      >
        {(c) => (
          <Input
            {...c}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            defaultValue={values?.time_cap_seconds ? values.time_cap_seconds / 60 : ""}
          />
        )}
      </FormField>
      <FormField label="Description / rules" name="description" errors={errors?.description}>
        {(c) => <Textarea {...c} rows={3} defaultValue={values?.description ?? ""} />}
      </FormField>
      {/* Rules have no editor yet; keep what is stored when saving an edit. */}
      <input type="hidden" name="rules" defaultValue={values?.rules ?? ""} />
      <FormAlert error={save.error} />
      <SubmitButton pending={save.isPending} pendingLabel={pendingLabel}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}

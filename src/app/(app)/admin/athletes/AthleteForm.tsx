"use client";

import type { ActionResult } from "@/lib/action-result";
import { fieldErrorsOf, useServerAction } from "@/lib/use-server-action";
import { NONE } from "@/lib/validation/none";
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

export type AthleteValues = {
  first_name: string;
  last_name: string;
  affiliate: string | null;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  gender: "male" | "female" | null;
};

/**
 * An athlete's profile fields, for adding one to the roster and (on the
 * athlete's page) editing them. `action` decides which.
 */
export function AthleteForm({
  action,
  values,
  submitLabel,
  pendingLabel,
  success,
  close,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  values?: AthleteValues;
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
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="First name" name="first_name" errors={errors?.first_name}>
          {(c) => (
            <Input {...c} required autoComplete="given-name" defaultValue={values?.first_name} />
          )}
        </FormField>
        <FormField label="Last name" name="last_name" errors={errors?.last_name}>
          {(c) => (
            <Input {...c} required autoComplete="family-name" defaultValue={values?.last_name} />
          )}
        </FormField>
      </div>
      <FormField label="Box / affiliate" name="affiliate" errors={errors?.affiliate}>
        {(c) => <Input {...c} defaultValue={values?.affiliate ?? ""} />}
      </FormField>
      <FormField label="Email" name="email" errors={errors?.email}>
        {(c) => (
          <Input
            {...c}
            type="email"
            required
            autoComplete="email"
            defaultValue={values?.email ?? ""}
          />
        )}
      </FormField>
      <FormField label="Phone" name="phone" errors={errors?.phone}>
        {(c) => (
          <Input
            {...c}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="Optional"
            defaultValue={values?.phone ?? ""}
          />
        )}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Date of birth" name="date_of_birth" errors={errors?.date_of_birth}>
          {(c) => <Input {...c} type="date" defaultValue={values?.date_of_birth ?? ""} />}
        </FormField>
        <FormField label="Gender" name="gender" errors={errors?.gender}>
          {({ name, ...c }) => (
            <Select name={name} defaultValue={values?.gender ?? NONE}>
              <SelectTrigger {...c} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not set</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          )}
        </FormField>
      </div>
      <FormAlert error={save.error} />
      <SubmitButton pending={save.isPending} pendingLabel={pendingLabel}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}

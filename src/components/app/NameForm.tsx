"use client";

import type { AnyActionResult } from "@/lib/action-result";
import { fieldErrorsOf, useServerAction } from "@/lib/use-server-action";
import { FormAlert } from "./FormAlert";
import { FormField } from "./FormField";
import { SubmitButton } from "./SubmitButton";
import { Input } from "@/components/ui/input";

/**
 * A one-field form (a division's name, a new floor's name) for a FormDialog:
 * posts `name`, shows its error under the field, closes on success.
 */
export function NameForm({
  action,
  label,
  placeholder,
  submitLabel,
  pendingLabel,
  success,
  close,
}: {
  action: (formData: FormData) => Promise<AnyActionResult>;
  label: string;
  placeholder?: string;
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
      <FormField label={label} name="name" errors={errors?.name}>
        {(c) => <Input {...c} required placeholder={placeholder} />}
      </FormField>
      <FormAlert error={save.error} />
      <SubmitButton pending={save.isPending} pendingLabel={pendingLabel}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { createCircuit } from "@/lib/actions/circuits";
import { fieldErrorsOf, useServerAction } from "@/lib/use-server-action";
import { FormAlert } from "@/components/app/FormAlert";
import { FormField } from "@/components/app/FormField";
import { SubmitButton } from "@/components/app/SubmitButton";
import { Input } from "@/components/ui/input";

/** Creates a circuit and opens it. */
export function CircuitForm() {
  const router = useRouter();
  const create = useServerAction(createCircuit, {
    success: "Circuit created",
    toastErrors: false,
    refresh: false,
    onSuccess: (data) => router.push(data.href),
  });
  const errors = fieldErrorsOf(create.error);
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate(new FormData(e.currentTarget));
      }}
    >
      <FormField label="Circuit name" name="name" errors={errors?.name}>
        {(c) => <Input {...c} required placeholder="Copa Aprieta 2027" />}
      </FormField>
      <FormField label="Description" name="description" errors={errors?.description}>
        {(c) => <Input {...c} />}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Season starts" name="starts_on" errors={errors?.starts_on}>
          {(c) => <Input {...c} type="date" />}
        </FormField>
        <FormField label="Season ends" name="ends_on" errors={errors?.ends_on}>
          {(c) => <Input {...c} type="date" />}
        </FormField>
      </div>
      <FormAlert error={create.error} />
      <SubmitButton pending={create.isPending} pendingLabel="Creating…">
        Create circuit
      </SubmitButton>
    </form>
  );
}

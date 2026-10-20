"use client";

import { bootstrapOrganization } from "@/lib/actions/org";
import { fieldErrorsOf, useServerAction } from "@/lib/use-server-action";
import { FormAlert } from "@/components/app/FormAlert";
import { FormField } from "@/components/app/FormField";
import { SubmitButton } from "@/components/app/SubmitButton";
import { Input } from "@/components/ui/input";

/** The one-time step that creates the organization. */
export function BootstrapOrgForm() {
  const create = useServerAction(bootstrapOrganization, {
    success: "Organization created",
    toastErrors: false,
  });
  const errors = fieldErrorsOf(create.error);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate(new FormData(e.currentTarget));
      }}
    >
      <FormField label="Organization name" name="name" errors={errors?.name}>
        {(c) => <Input {...c} required placeholder="e.g. RepOneLive" />}
      </FormField>
      <FormAlert error={create.error} />
      <SubmitButton pending={create.isPending} pendingLabel="Creating…">
        Create organization
      </SubmitButton>
    </form>
  );
}

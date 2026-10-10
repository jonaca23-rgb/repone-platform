"use client";

import { createSponsor, updateSponsor } from "@/lib/actions/sponsors";
import { fieldErrorsOf, useServerAction } from "@/lib/use-server-action";
import { FormAlert } from "@/components/app/FormAlert";
import { FormField } from "@/components/app/FormField";
import { SubmitButton } from "@/components/app/SubmitButton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Sponsor = {
  id: string;
  business_name: string;
  category: string | null;
  website: string | null;
  notes: string | null;
};

/** Adds a sponsor, or edits one when given `sponsor`. */
export function SponsorForm({ sponsor, close }: { sponsor?: Sponsor; close: () => void }) {
  const save = useServerAction(
    (fd: FormData) => (sponsor ? updateSponsor(sponsor.id, fd) : createSponsor(fd)),
    { success: sponsor ? "Sponsor saved" : "Sponsor added", toastErrors: false, onSuccess: close },
  );
  const errors = fieldErrorsOf(save.error);

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(new FormData(e.currentTarget));
      }}
    >
      <FormField label="Business name" name="business_name" errors={errors?.business_name}>
        {(c) => (
          <Input
            {...c}
            required
            autoComplete="organization"
            defaultValue={sponsor?.business_name}
          />
        )}
      </FormField>
      <FormField
        label="Category"
        name="category"
        errors={errors?.category}
        description="An event can give one sponsor its category exclusively."
      >
        {(c) => (
          <Input
            {...c}
            placeholder="Physical Therapy"
            defaultValue={sponsor?.category ?? undefined}
          />
        )}
      </FormField>
      <FormField label="Website" name="website" errors={errors?.website}>
        {(c) => (
          <Input
            {...c}
            inputMode="url"
            placeholder="https://"
            defaultValue={sponsor?.website ?? undefined}
          />
        )}
      </FormField>
      <FormField label="Notes" name="notes" errors={errors?.notes}>
        {(c) => <Textarea {...c} rows={3} defaultValue={sponsor?.notes ?? undefined} />}
      </FormField>
      <FormAlert error={save.error} />
      <SubmitButton pending={save.isPending} pendingLabel="Saving…">
        {sponsor ? "Save sponsor" : "Add sponsor"}
      </SubmitButton>
    </form>
  );
}

"use client";

import { createSponsorPackage, updateSponsorPackage } from "@/lib/actions/sponsorPackages";
import { fieldErrorsOf, useServerAction } from "@/lib/use-server-action";
import { FormAlert } from "@/components/app/FormAlert";
import { FormField } from "@/components/app/FormField";
import { SubmitButton } from "@/components/app/SubmitButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export type PackageRow = {
  id: string;
  name: string;
  display_enabled: boolean;
  display_duration_seconds: number;
  display_weight: number;
  sort_order: number;
  active: boolean;
};

/** Adds a package, or edits one when given `pkg`. */
export function PackageForm({ pkg, close }: { pkg?: PackageRow; close: () => void }) {
  const save = useServerAction(
    (fd: FormData) => (pkg ? updateSponsorPackage(pkg.id, fd) : createSponsorPackage(fd)),
    { success: pkg ? "Package saved" : "Package added", toastErrors: false, onSuccess: close },
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
      <FormField label="Package name" name="name" errors={errors?.name}>
        {(c) => <Input {...c} required defaultValue={pkg?.name} placeholder="WOD Sponsor" />}
      </FormField>
      <div className="flex min-h-11 items-center gap-3">
        <Switch
          id="package-display"
          name="display_enabled"
          defaultChecked={pkg?.display_enabled ?? true}
        />
        <Label htmlFor="package-display">Show on the venue display</Label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Seconds on screen"
          name="display_duration_seconds"
          errors={errors?.display_duration_seconds}
          description="3 to 60."
        >
          {(c) => (
            <Input
              {...c}
              type="number"
              inputMode="numeric"
              min={3}
              max={60}
              required
              defaultValue={pkg?.display_duration_seconds ?? 10}
            />
          )}
        </FormField>
        <FormField
          label="Weight"
          name="display_weight"
          errors={errors?.display_weight}
          description="1 to 10. Weight 2 shows twice as often as weight 1."
        >
          {(c) => (
            <Input
              {...c}
              type="number"
              inputMode="numeric"
              min={1}
              max={10}
              required
              defaultValue={pkg?.display_weight ?? 1}
            />
          )}
        </FormField>
      </div>
      <FormField
        label="Order"
        name="sort_order"
        errors={errors?.sort_order}
        description="Lower numbers list first."
      >
        {(c) => (
          <Input
            {...c}
            type="number"
            inputMode="numeric"
            min={0}
            max={1000}
            defaultValue={pkg?.sort_order ?? 0}
          />
        )}
      </FormField>
      <FormAlert error={save.error} />
      <SubmitButton pending={save.isPending} pendingLabel="Saving…">
        {pkg ? "Save package" : "Add package"}
      </SubmitButton>
    </form>
  );
}

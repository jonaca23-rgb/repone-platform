"use client";

import { useState } from "react";
import { addEventSponsorship, updateEventSponsorship } from "@/lib/actions/eventSponsorships";
import { fieldErrorsOf, useServerAction } from "@/lib/use-server-action";
import { FormAlert } from "@/components/app/FormAlert";
import { FormField } from "@/components/app/FormField";
import { SubmitButton } from "@/components/app/SubmitButton";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type PackageOption = {
  id: string;
  name: string;
  display_duration_seconds: number;
  display_weight: number;
  active: boolean;
};
export type SponsorOption = { id: string; business_name: string; category: string | null };
export type Editing = {
  id: string;
  sponsorName: string;
  packageId: string;
  exclusive: boolean;
  durationOverride: number | null;
  weightOverride: number | null;
};

function PackageSelect({
  packages,
  value,
  errors,
  onChange,
}: {
  packages: PackageOption[];
  value?: string;
  errors?: string[];
  onChange?: (id: string) => void;
}) {
  // A switched-off package stays selectable for the sponsorship already on it.
  const options = packages.filter((p) => p.active || p.id === value);
  return (
    <FormField label="Package" name="package_id" errors={errors}>
      {({ name, ...c }) => (
        <Select name={name} defaultValue={value} required onValueChange={onChange}>
          <SelectTrigger {...c} className="w-full">
            <SelectValue placeholder="Choose a package" />
          </SelectTrigger>
          <SelectContent>
            {options.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </FormField>
  );
}

function ExclusiveCheckbox({
  defaultChecked,
  errors,
}: {
  defaultChecked?: boolean;
  errors?: string[];
}) {
  const error = errors?.[0];
  return (
    <div className="grid gap-1">
      <div className="flex min-h-11 items-center gap-2">
        <Checkbox
          id="sponsorship-exclusive"
          name="category_exclusive"
          defaultChecked={defaultChecked}
          aria-describedby="sponsorship-exclusive-hint"
          aria-invalid={error ? true : undefined}
        />
        <Label htmlFor="sponsorship-exclusive">Holds its category exclusively at this event</Label>
      </div>
      <p
        id="sponsorship-exclusive-hint"
        className={error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
      >
        {error ?? "Only for a sponsor with a category."}
      </p>
    </div>
  );
}

/** Puts one of the organization's sponsors on this event. */
export function AddEventSponsorForm({
  eventId,
  sponsors,
  packages,
  close,
}: {
  eventId: string;
  sponsors: SponsorOption[];
  packages: PackageOption[];
  close: () => void;
}) {
  const save = useServerAction((fd: FormData) => addEventSponsorship(eventId, fd), {
    success: "Sponsor added to the event",
    toastErrors: false,
    onSuccess: close,
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
      <FormField label="Sponsor" name="sponsor_id" errors={errors?.sponsor_id}>
        {({ name, ...c }) => (
          <Select name={name} required>
            <SelectTrigger {...c} className="w-full">
              <SelectValue placeholder="Choose a sponsor" />
            </SelectTrigger>
            <SelectContent>
              {sponsors.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.category ? `${s.business_name} · ${s.category}` : s.business_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>
      <PackageSelect packages={packages} errors={errors?.package_id} />
      <ExclusiveCheckbox errors={errors?.category_exclusive} />
      <FormAlert error={save.error} />
      <SubmitButton pending={save.isPending} pendingLabel="Adding…">
        Add sponsor
      </SubmitButton>
    </form>
  );
}

/**
 * Changes a sponsorship's package, exclusivity and display overrides. Blank
 * overrides use the package's own duration and weight, shown as placeholders.
 */
export function EditEventSponsorForm({
  eventId,
  sponsorship,
  packages,
  close,
}: {
  eventId: string;
  sponsorship: Editing;
  packages: PackageOption[];
  close: () => void;
}) {
  const save = useServerAction(
    (fd: FormData) => updateEventSponsorship(eventId, sponsorship.id, fd),
    { success: "Sponsorship saved", toastErrors: false, onSuccess: close },
  );
  const errors = fieldErrorsOf(save.error);
  // The overrides' placeholders follow the package as it is chosen.
  const [packageId, setPackageId] = useState(sponsorship.packageId);
  const pkg = packages.find((p) => p.id === packageId);
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(new FormData(e.currentTarget));
      }}
    >
      <PackageSelect
        packages={packages}
        value={sponsorship.packageId}
        errors={errors?.package_id}
        onChange={setPackageId}
      />
      <ExclusiveCheckbox
        defaultChecked={sponsorship.exclusive}
        errors={errors?.category_exclusive}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Seconds on screen"
          name="display_duration_override"
          errors={errors?.display_duration_override}
          description="Blank uses the package's."
        >
          {(c) => (
            <Input
              {...c}
              type="number"
              inputMode="numeric"
              min={3}
              max={60}
              placeholder={pkg ? String(pkg.display_duration_seconds) : undefined}
              defaultValue={sponsorship.durationOverride ?? undefined}
            />
          )}
        </FormField>
        <FormField
          label="Weight"
          name="display_weight_override"
          errors={errors?.display_weight_override}
          description="Blank uses the package's."
        >
          {(c) => (
            <Input
              {...c}
              type="number"
              inputMode="numeric"
              min={1}
              max={10}
              placeholder={pkg ? String(pkg.display_weight) : undefined}
              defaultValue={sponsorship.weightOverride ?? undefined}
            />
          )}
        </FormField>
      </div>
      <FormAlert error={save.error} />
      <SubmitButton pending={save.isPending} pendingLabel="Saving…">
        Save sponsorship
      </SubmitButton>
    </form>
  );
}

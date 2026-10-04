"use client";

import { createSponsor } from "@/lib/actions/sponsors";
import { fieldErrorsOf, useServerAction } from "@/lib/use-server-action";
import { NONE } from "@/lib/validation/none";
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
import { TIER_OPTIONS } from "./tiers";

/** Adds a sponsor; lives in the Add sponsor dialog. */
export function SponsorForm({
  events,
  close,
}: {
  events: { id: string; name: string }[];
  close: () => void;
}) {
  const save = useServerAction(createSponsor, {
    success: "Sponsor added",
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
      <FormField label="Business name" name="business_name" errors={errors?.business_name}>
        {(c) => <Input {...c} required autoComplete="organization" />}
      </FormField>
      <FormField label="Tier" name="tier" errors={errors?.tier}>
        {({ name, ...c }) => (
          <Select name={name} defaultValue="logo_sponsor">
            <SelectTrigger {...c} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIER_OPTIONS.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>
      <FormField label="Event" name="event_id" errors={errors?.event_id}>
        {({ name, ...c }) => (
          <Select name={name} defaultValue={NONE}>
            <SelectTrigger {...c} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>All events</SelectItem>
              {events.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>
      <FormField label="Category" name="category" errors={errors?.category}>
        {(c) => <Input {...c} placeholder="Physical Therapy" />}
      </FormField>
      <div className="flex min-h-11 items-center gap-2">
        <Checkbox id="sponsor-exclusive" name="category_exclusive" />
        <Label htmlFor="sponsor-exclusive">Category exclusive</Label>
      </div>
      <FormField label="Website" name="website" errors={errors?.website}>
        {(c) => <Input {...c} inputMode="url" placeholder="https://" />}
      </FormField>
      <FormAlert error={save.error} />
      <SubmitButton pending={save.isPending} pendingLabel="Adding…">
        Add sponsor
      </SubmitButton>
    </form>
  );
}

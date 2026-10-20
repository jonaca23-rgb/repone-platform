"use client";

import { createFeeSchedule } from "@/lib/actions/fees";
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
import { ENTRY_TYPE_OPTIONS } from "./entryTypes";

/** Adds a fee to the event's price menu. */
export function FeeForm({
  eventId,
  divisions,
  close,
}: {
  eventId: string;
  divisions: { id: string; name: string }[];
  close: () => void;
}) {
  const save = useServerAction((fd: FormData) => createFeeSchedule(eventId, fd), {
    success: "Fee added",
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
      <FormField label="Fee name" name="name" errors={errors?.name}>
        {(c) => <Input {...c} required placeholder="Individual Registration" />}
      </FormField>
      <FormField label="Amount (USD)" name="amount_dollars" errors={errors?.amount_dollars}>
        {(c) => (
          <Input
            {...c}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            required
            placeholder="75.00"
          />
        )}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Division" name="division_id" errors={errors?.division_id}>
          {({ name, ...c }) => (
            <Select name={name} defaultValue={NONE}>
              <SelectTrigger {...c} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Any division</SelectItem>
                {divisions.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
        <FormField label="Entry type" name="entry_type" errors={errors?.entry_type}>
          {({ name, ...c }) => (
            <Select name={name} defaultValue={NONE}>
              <SelectTrigger {...c} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Any entry type</SelectItem>
                {ENTRY_TYPE_OPTIONS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
      </div>
      <FormField label="Description" name="description" errors={errors?.description}>
        {(c) => <Input {...c} placeholder="Optional" />}
      </FormField>
      <div className="flex min-h-11 items-center gap-2">
        <Checkbox id="fee-addon" name="is_addon" />
        <Label htmlFor="fee-addon">Optional add-on (not a base registration fee)</Label>
      </div>
      <FormAlert error={save.error} />
      <SubmitButton pending={save.isPending} pendingLabel="Adding…">
        Add fee
      </SubmitButton>
    </form>
  );
}

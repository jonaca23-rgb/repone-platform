"use client";

import { createTeam } from "@/lib/actions/teams";
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
import { ENTRY_FORMAT_OPTIONS } from "./formats";

/** Creates a team; lives in the New team dialog. */
export function TeamForm({ close }: { close: () => void }) {
  const create = useServerAction(createTeam, {
    success: "Team created",
    toastErrors: false,
    onSuccess: close,
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
      <FormField label="Team name" name="name" errors={errors?.name}>
        {(c) => <Input {...c} required placeholder="Box Wolves" />}
      </FormField>
      <FormField label="Box / affiliate" name="affiliate" errors={errors?.affiliate}>
        {(c) => <Input {...c} />}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Entry format" name="entry_format" errors={errors?.entry_format}>
          {({ name, ...c }) => (
            <Select name={name} defaultValue="team">
              <SelectTrigger {...c} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTRY_FORMAT_OPTIONS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
        <FormField
          label="Headcount"
          name="team_size"
          errors={errors?.team_size}
          description="For display and fees only."
        >
          {(c) => <Input {...c} type="number" inputMode="numeric" min={1} placeholder="e.g. 4" />}
        </FormField>
      </div>
      <FormAlert error={create.error} />
      <SubmitButton pending={create.isPending} pendingLabel="Creating…">
        Create team
      </SubmitButton>
    </form>
  );
}

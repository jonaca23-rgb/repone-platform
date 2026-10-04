"use client";

import { addTeamMember } from "@/lib/actions/teams";
import { fieldErrorsOf, useServerAction } from "@/lib/use-server-action";
import { FormAlert } from "@/components/app/FormAlert";
import { FormField } from "@/components/app/FormField";
import { SubmitButton } from "@/components/app/SubmitButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type RosterOption = { id: string; label: string };

/** Puts one more athlete on a team's roster. */
export function AddRosterMemberForm({
  teamId,
  athletes,
  close,
}: {
  teamId: string;
  athletes: RosterOption[];
  close: () => void;
}) {
  const add = useServerAction((fd: FormData) => addTeamMember(teamId, fd), {
    success: "Added to the roster",
    toastErrors: false,
    onSuccess: close,
  });
  const errors = fieldErrorsOf(add.error);
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        add.mutate(new FormData(e.currentTarget));
      }}
    >
      <FormField label="Athlete" name="athlete_id" errors={errors?.athlete_id}>
        {({ name, ...c }) => (
          <Select name={name} defaultValue={athletes[0]?.id}>
            <SelectTrigger {...c} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {athletes.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>
      <FormAlert error={add.error} />
      <SubmitButton pending={add.isPending} pendingLabel="Adding…">
        Add to roster
      </SubmitButton>
    </form>
  );
}

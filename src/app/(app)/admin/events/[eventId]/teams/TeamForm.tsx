"use client";

import { createTeam, updateTeam } from "@/lib/actions/teams";
import { type EntryFormat, formatLabel } from "@/lib/teams/format";
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

export type TeamDivision = { id: string; name: string; format: EntryFormat; size: number | null };

/**
 * Adds a team to one of the event's team divisions, or edits one when given
 * `team`. A team's division is fixed once it exists: its registration, heats
 * and results are in it.
 */
export function TeamForm({
  eventId,
  divisions,
  team,
  close,
}: {
  eventId: string;
  divisions: TeamDivision[];
  team?: { id: string; name: string; affiliate: string | null };
  close: () => void;
}) {
  const save = useServerAction(
    (fd: FormData) => (team ? updateTeam(eventId, team.id, fd) : createTeam(eventId, fd)),
    { success: team ? "Team saved" : "Team added", toastErrors: false, onSuccess: close },
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
      <FormField label="Team name" name="name" errors={errors?.name}>
        {(c) => <Input {...c} required defaultValue={team?.name} />}
      </FormField>
      {team ? null : (
        <FormField label="Division" name="division_id" errors={errors?.division_id}>
          {({ name, ...c }) => (
            <Select
              name={name}
              required
              defaultValue={divisions.length === 1 ? divisions[0].id : undefined}
            >
              <SelectTrigger {...c} className="w-full">
                <SelectValue placeholder="Choose a division" />
              </SelectTrigger>
              <SelectContent>
                {divisions.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name} · {formatLabel(d.format, d.size)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
      )}
      <FormField label="Affiliate" name="affiliate" errors={errors?.affiliate}>
        {(c) => (
          <Input
            {...c}
            placeholder="CrossFit Aprieta"
            defaultValue={team?.affiliate ?? undefined}
          />
        )}
      </FormField>
      <FormAlert error={save.error} />
      <SubmitButton pending={save.isPending} pendingLabel="Saving…">
        {team ? "Save team" : "Add team"}
      </SubmitButton>
    </form>
  );
}

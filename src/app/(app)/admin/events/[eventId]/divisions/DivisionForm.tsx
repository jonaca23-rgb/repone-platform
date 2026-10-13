"use client";

import { useState } from "react";
import { createDivision, updateDivision } from "@/lib/actions/divisions";
import type { EntryFormat } from "@/lib/teams/format";
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

const FORMATS: Array<[EntryFormat, string]> = [
  ["individual", "Individual"],
  ["pair", "Pair"],
  ["team", "Team"],
];

type Division = { id: string; name: string; entry_format: EntryFormat; team_size: number | null };

/** Adds a division, or edits one when given `division`: its name and what competes in it. */
export function DivisionForm({
  eventId,
  division,
  close,
}: {
  eventId: string;
  division?: Division;
  close: () => void;
}) {
  // "custom" divisions (none are created here) edit as Team.
  const [format, setFormat] = useState<EntryFormat>(
    division?.entry_format === "custom" ? "team" : (division?.entry_format ?? "individual"),
  );
  const save = useServerAction(
    (fd: FormData) =>
      division ? updateDivision(eventId, division.id, fd) : createDivision(eventId, fd),
    {
      success: division ? "Division saved" : "Division added",
      toastErrors: false,
      onSuccess: close,
    },
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
      <FormField label="Division name" name="name" errors={errors?.name}>
        {(c) => (
          <Input {...c} required placeholder="Intermediate Female" defaultValue={division?.name} />
        )}
      </FormField>
      <FormField
        label="Format"
        name="entry_format"
        errors={errors?.entry_format}
        description="Who competes in this division: one athlete, or a team."
      >
        {({ name, ...c }) => (
          <Select name={name} value={format} onValueChange={(v) => setFormat(v as EntryFormat)}>
            <SelectTrigger {...c} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMATS.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>
      {format === "team" ? (
        <FormField
          label="Athletes per team"
          name="team_size"
          errors={errors?.team_size}
          description="2 to 20."
        >
          {(c) => (
            <Input
              {...c}
              type="number"
              inputMode="numeric"
              min={2}
              max={20}
              required
              defaultValue={division?.team_size ?? 4}
            />
          )}
        </FormField>
      ) : format === "pair" ? (
        <p className="text-sm text-muted-foreground">A pair is two athletes per team.</p>
      ) : null}
      <FormAlert error={save.error} />
      <SubmitButton pending={save.isPending} pendingLabel="Saving…">
        {division ? "Save division" : "Add division"}
      </SubmitButton>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createEvent } from "@/lib/actions/events";
import { fieldErrorsOf, useServerAction } from "@/lib/use-server-action";
import { NONE } from "@/lib/validation/none";
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

/** Creates an event, standalone or in a circuit, and opens it. */
export function NewEventForm({ circuits }: { circuits: { id: string; name: string }[] }) {
  const router = useRouter();
  const [choice, setChoice] = useState<string>(NONE);
  const create = useServerAction(createEvent, {
    success: "Event created",
    toastErrors: false,
    refresh: false,
    onSuccess: (data) => router.push(data.href),
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
      <FormField label="Event name" name="name" errors={errors?.name}>
        {(c) => <Input {...c} required placeholder="Aprieta Entry Level" />}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Starts" name="starts_on" errors={errors?.starts_on}>
          {(c) => <Input {...c} type="date" />}
        </FormField>
        <FormField label="Ends" name="ends_on" errors={errors?.ends_on}>
          {(c) => <Input {...c} type="date" />}
        </FormField>
      </div>
      <FormField
        label="Single event or circuit?"
        name="circuit_choice"
        errors={errors?.circuit_choice}
      >
        {({ name, ...c }) => (
          <Select name={name} value={choice} onValueChange={setChoice}>
            <SelectTrigger {...c} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Single event (standalone)</SelectItem>
              <SelectItem value="new">Start a new circuit…</SelectItem>
              {circuits.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  Add to circuit: {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>
      {choice === "new" ? (
        <FormField
          label="New circuit name"
          name="new_circuit_name"
          errors={errors?.new_circuit_name}
        >
          {(c) => <Input {...c} required placeholder="Copa Aprieta 2027" />}
        </FormField>
      ) : null}
      <FormAlert error={create.error} />
      <SubmitButton pending={create.isPending} pendingLabel="Creating…">
        Create event
      </SubmitButton>
    </form>
  );
}

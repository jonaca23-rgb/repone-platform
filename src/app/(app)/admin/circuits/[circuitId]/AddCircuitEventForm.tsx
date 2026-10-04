"use client";

import { Plus } from "lucide-react";
import { addEventToCircuit } from "@/lib/actions/circuits";
import { fieldErrorsOf, useServerAction } from "@/lib/use-server-action";
import { FormAlert } from "@/components/app/FormAlert";
import { FormDialog } from "@/components/app/FormDialog";
import { FormField } from "@/components/app/FormField";
import { SubmitButton } from "@/components/app/SubmitButton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function AddEventForm({
  circuitId,
  events,
  close,
}: {
  circuitId: string;
  events: { id: string; name: string }[];
  close: () => void;
}) {
  const add = useServerAction((fd: FormData) => addEventToCircuit(circuitId, fd), {
    success: "Event added to the circuit",
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
      <FormField label="Standalone event" name="event_id" errors={errors?.event_id}>
        {({ name, ...c }) => (
          <Select name={name} defaultValue={events[0]?.id}>
            <SelectTrigger {...c} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {events.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>
      <FormAlert error={add.error} />
      <SubmitButton pending={add.isPending} pendingLabel="Adding…">
        Add to this circuit
      </SubmitButton>
    </form>
  );
}

/** "Add event", or a disabled button saying why when every event is already in a circuit. */
export function AddCircuitEvent({
  circuitId,
  events,
}: {
  circuitId: string;
  events: { id: string; name: string }[];
}) {
  if (events.length === 0) {
    return (
      <Button variant="outline" disabled title="Every event is already part of a circuit.">
        <Plus aria-hidden /> Add event
      </Button>
    );
  }
  return (
    <FormDialog
      title="Add an event to this circuit"
      trigger={
        <Button variant="outline">
          <Plus aria-hidden /> Add event
        </Button>
      }
    >
      {(close) => <AddEventForm circuitId={circuitId} events={events} close={close} />}
    </FormDialog>
  );
}

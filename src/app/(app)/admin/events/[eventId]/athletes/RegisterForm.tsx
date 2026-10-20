"use client";

import Link from "next/link";
import { registerAthlete } from "@/lib/actions/registrations";
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

export type Option = { id: string; label: string };

/**
 * Registers an athlete into one of this event's individual divisions. The
 * division defaults to the last one used here. Pairs and teams are created,
 * and registered, on the event's Teams page.
 */
export function RegisterForm({
  eventId,
  athletes,
  divisions,
  defaultDivisionId,
  close,
}: {
  eventId: string;
  athletes: Option[];
  divisions: Option[];
  defaultDivisionId: string;
  close: () => void;
}) {
  const register = useServerAction((fd: FormData) => registerAthlete(eventId, fd), {
    success: "Registered",
    toastErrors: false,
    onSuccess: close,
  });
  const errors = fieldErrorsOf(register.error);

  if (athletes.length === 0) {
    return (
      <p className="text-muted-foreground">
        Your organization has no athletes yet.{" "}
        <Link href="/admin/athletes" className="text-brand-text underline">
          Add athletes
        </Link>{" "}
        first.
      </p>
    );
  }
  if (divisions.length === 0) {
    return (
      <p className="text-muted-foreground">
        This event has no individual division. Athletes join a pair or team division through{" "}
        <Link href={`/admin/events/${eventId}/teams`} className="text-brand-text underline">
          Teams
        </Link>
        .
      </p>
    );
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        register.mutate(new FormData(e.currentTarget));
      }}
    >
      <FormField label="Athlete" name="athlete_id" errors={errors?.athlete_id}>
        {({ name, ...c }) => (
          <Select name={name} defaultValue={athletes[0].id}>
            <SelectTrigger {...c} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {athletes.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>
      <FormField label="Division" name="division_id" errors={errors?.division_id}>
        {({ name, ...c }) => (
          <Select name={name} defaultValue={defaultDivisionId}>
            <SelectTrigger {...c} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {divisions.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>
      <FormField label="Bib number" name="bib_number" errors={errors?.bib_number}>
        {(c) => <Input {...c} inputMode="numeric" placeholder="Optional" />}
      </FormField>
      <FormAlert error={register.error} />
      <SubmitButton pending={register.isPending} pendingLabel="Registering…">
        Register
      </SubmitButton>
    </form>
  );
}

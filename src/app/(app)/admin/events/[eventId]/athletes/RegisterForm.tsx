"use client";

import Link from "next/link";
import { registerAthlete, registerTeam } from "@/lib/actions/registrations";
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
 * Registers an athlete (or a pair, team or custom entry) into one of this
 * event's divisions. The division defaults to the last one used here.
 */
export function RegisterForm({
  kind,
  eventId,
  competitors,
  divisions,
  defaultDivisionId,
  close,
}: {
  kind: "athlete" | "team";
  eventId: string;
  competitors: Option[];
  divisions: Option[];
  defaultDivisionId: string;
  close: () => void;
}) {
  const register = useServerAction(
    (fd: FormData) =>
      kind === "athlete" ? registerAthlete(eventId, fd) : registerTeam(eventId, fd),
    { success: "Registered", toastErrors: false, onSuccess: close },
  );
  const errors = fieldErrorsOf(register.error);
  const field = kind === "athlete" ? "athlete_id" : "team_id";

  if (competitors.length === 0) {
    return kind === "athlete" ? (
      <p className="text-muted-foreground">
        Your organization has no athletes yet.{" "}
        <Link href="/admin/athletes" className="text-brand-text underline">
          Add athletes
        </Link>{" "}
        first.
      </p>
    ) : (
      <p className="text-muted-foreground">
        Your organization has no teams yet.{" "}
        <Link href="/admin/teams" className="text-brand-text underline">
          Create a team
        </Link>{" "}
        first.
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
      <FormField
        label={kind === "athlete" ? "Athlete" : "Team or entry"}
        name={field}
        errors={errors?.[field]}
      >
        {({ name, ...c }) => (
          <Select name={name} defaultValue={competitors[0].id}>
            <SelectTrigger {...c} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {competitors.map((o) => (
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

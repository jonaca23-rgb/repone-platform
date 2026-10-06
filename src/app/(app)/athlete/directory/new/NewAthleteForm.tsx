"use client";

import { useRouter } from "next/navigation";
import { createAthleteFromPortal } from "@/lib/actions/social";
import { fieldErrorsOf, useServerAction } from "@/lib/use-server-action";
import { FormAlert } from "@/components/app/FormAlert";
import { FormField } from "@/components/app/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const FIELDS = [
  { name: "first_name", label: "First name", required: true },
  { name: "last_name", label: "Last name", required: true },
  { name: "affiliate", label: "Affiliate / gym (optional)", required: false },
  { name: "email", label: "Email", required: true, type: "email" },
  { name: "phone", label: "Phone (optional)", required: false, type: "tel" },
] as const;

/** Add someone to the roster; a failure shows here and keeps what was typed. */
export function NewAthleteForm() {
  const router = useRouter();
  const add = useServerAction(createAthleteFromPortal, {
    success: "Athlete added.",
    toastErrors: false,
    refresh: false,
    onSuccess: (data) => router.push(data.href),
  });
  const errors = fieldErrorsOf(add.error);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        add.mutate(new FormData(e.currentTarget));
      }}
      className="flex flex-col gap-4"
    >
      {FIELDS.map((f) => (
        <FormField key={f.name} label={f.label} name={f.name} errors={errors?.[f.name]}>
          {(control) => (
            <Input
              {...control}
              type={"type" in f ? f.type : "text"}
              required={f.required}
              autoComplete="off"
              className="h-11"
            />
          )}
        </FormField>
      ))}
      <FormAlert error={add.error} />
      <Button
        type="submit"
        size="touch"
        disabled={add.isPending || add.isSuccess}
        className="mt-2 w-full"
      >
        {add.isPending ? "Adding…" : "Add Athlete"}
      </Button>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { completeAthleteOnboarding } from "@/lib/actions/onboarding";
import { fieldErrorsOf, useServerAction } from "@/lib/use-server-action";
import { FormAlert } from "@/components/app/FormAlert";
import { FormField } from "@/components/app/FormField";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NONE } from "@/lib/validation/none";

const FIELDS = [
  { name: "first_name", label: "First name", required: true, autoComplete: "given-name" },
  { name: "last_name", label: "Last name", required: true, autoComplete: "family-name" },
  {
    name: "affiliate",
    label: "Box / affiliate",
    placeholder: "Optional",
    autoComplete: "organization",
  },
  { name: "email", label: "Email", required: true, type: "email", autoComplete: "email" },
  { name: "phone", label: "Phone", placeholder: "Optional", type: "tel", autoComplete: "tel" },
  { name: "date_of_birth", label: "Date of birth", type: "date", autoComplete: "bday" },
] as const;

export function OnboardingForm({ defaultEmail }: { defaultEmail: string }) {
  const router = useRouter();
  const [gender, setGender] = useState(NONE);
  // Submitted by hand rather than as <form action>: React resets a form's
  // uncontrolled fields after its action runs, which would wipe what the
  // person typed when the action fails.
  const save = useServerAction(completeAthleteOnboarding, {
    toastErrors: false,
    refresh: false,
    onSuccess: (data) => router.push(data.href),
  });
  const errors = fieldErrorsOf(save.error);

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <h1 className="font-display text-2xl font-bold tracking-wide uppercase">
          Tell us about yourself
        </h1>
        <CardDescription>
          This creates your athlete profile in RepOne Platform, separate from your login.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(new FormData(e.currentTarget));
          }}
          className="flex flex-col gap-4"
        >
          {FIELDS.map((f) => (
            <FormField key={f.name} label={f.label} name={f.name} errors={errors?.[f.name]}>
              {(control) => (
                <Input
                  {...control}
                  type={"type" in f ? f.type : "text"}
                  required={"required" in f ? f.required : false}
                  placeholder={"placeholder" in f ? f.placeholder : undefined}
                  autoComplete={f.autoComplete}
                  defaultValue={f.name === "email" ? defaultEmail : undefined}
                  className="h-11"
                />
              )}
            </FormField>
          ))}
          <FormField label="Gender" name="gender_choice" errors={errors?.gender}>
            {(control) => (
              <>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger
                    id={control.id}
                    aria-invalid={control["aria-invalid"]}
                    aria-describedby={control["aria-describedby"]}
                    className="w-full data-[size=default]:h-11"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
                {/* The action reads "" (not the Select's NONE) as not given. */}
                <input type="hidden" name="gender" value={gender === NONE ? "" : gender} />
              </>
            )}
          </FormField>

          <FormAlert error={save.error} />

          <Button type="submit" size="touch" disabled={save.isPending} className="mt-2 w-full">
            {save.isPending ? "Saving…" : "Continue"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

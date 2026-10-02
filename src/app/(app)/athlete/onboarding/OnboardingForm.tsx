"use client";

import { type FormEvent, startTransition, useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NONE } from "@/lib/validation/none";
import { completeAthleteOnboarding } from "../actions";

export function OnboardingForm({ defaultEmail }: { defaultEmail: string }) {
  const [state, formAction, pending] = useActionState(completeAthleteOnboarding, undefined);
  const [gender, setGender] = useState(NONE);

  // Submitted through the action by hand rather than as <form action>: React
  // resets a form's uncontrolled fields after its action runs, which would
  // wipe what the person typed when the action returns an error.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

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
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="onb-first-name">First name</Label>
            <Input
              id="onb-first-name"
              name="first_name"
              required
              autoComplete="given-name"
              className="h-11"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="onb-last-name">Last name</Label>
            <Input
              id="onb-last-name"
              name="last_name"
              required
              autoComplete="family-name"
              className="h-11"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="onb-affiliate">Box / affiliate</Label>
            <Input
              id="onb-affiliate"
              name="affiliate"
              placeholder="Optional"
              autoComplete="organization"
              className="h-11"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="onb-email">Email</Label>
            <Input
              id="onb-email"
              type="email"
              name="email"
              required
              defaultValue={defaultEmail}
              autoComplete="email"
              className="h-11"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="onb-phone">Phone</Label>
            <Input
              id="onb-phone"
              type="tel"
              name="phone"
              placeholder="Optional"
              autoComplete="tel"
              className="h-11"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="onb-dob">Date of birth</Label>
            <Input
              id="onb-dob"
              type="date"
              name="date_of_birth"
              autoComplete="bday"
              className="h-11"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="onb-gender">Gender</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger id="onb-gender" className="w-full data-[size=default]:h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
            {/* The action reads "" (not the Select's NONE) as not given, as the old native select posted. */}
            <input type="hidden" name="gender" value={gender === NONE ? "" : gender} />
          </div>

          {state?.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}

          <Button type="submit" size="touch" disabled={pending} className="mt-2 w-full">
            {pending ? "Saving…" : "Continue"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

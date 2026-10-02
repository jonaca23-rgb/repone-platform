"use client";

import { type FormEvent, startTransition, useActionState } from "react";
import { completeAthleteOnboarding } from "../actions";

export function OnboardingForm({ defaultEmail }: { defaultEmail: string }) {
  const [state, formAction, pending] = useActionState(completeAthleteOnboarding, undefined);

  // Submitted through the action by hand rather than as <form action>: React
  // resets a form's uncontrolled fields after its action runs, which would
  // wipe what the person typed when the action returns an error.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <div className="mx-auto w-full max-w-sm rounded-xl border border-white/10 bg-repone-gray p-8 shadow-xl">
      <h1 className="mb-1 text-xl font-bold text-white">Tell us about yourself</h1>
      <p className="mb-6 text-sm text-white/60">
        This creates your athlete profile in RepOne Platform, separate from your login.
      </p>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-white/80">
          First name
          <input
            name="first_name"
            required
            className="rounded-md border border-white/20 bg-black/40 px-3 py-2 text-white outline-none focus:border-repone-red"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-white/80">
          Last name
          <input
            name="last_name"
            required
            className="rounded-md border border-white/20 bg-black/40 px-3 py-2 text-white outline-none focus:border-repone-red"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-white/80">
          Box / affiliate
          <input
            name="affiliate"
            placeholder="Optional"
            className="rounded-md border border-white/20 bg-black/40 px-3 py-2 text-white outline-none focus:border-repone-red"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-white/80">
          Email
          <input
            type="email"
            name="email"
            required
            defaultValue={defaultEmail}
            className="rounded-md border border-white/20 bg-black/40 px-3 py-2 text-white outline-none focus:border-repone-red"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-white/80">
          Phone
          <input
            type="tel"
            name="phone"
            placeholder="Optional"
            className="rounded-md border border-white/20 bg-black/40 px-3 py-2 text-white outline-none focus:border-repone-red"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-white/80">
          Date of birth
          <input
            type="date"
            name="date_of_birth"
            className="rounded-md border border-white/20 bg-black/40 px-3 py-2 text-white outline-none focus:border-repone-red"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-white/80">
          Gender
          <select
            name="gender"
            defaultValue=""
            className="rounded-md border border-white/20 bg-black/40 px-3 py-2 text-white outline-none focus:border-repone-red"
          >
            <option value="">—</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </label>

        {state?.error ? <p className="text-sm text-repone-red">{state.error}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-md bg-repone-red px-4 py-3 font-semibold uppercase tracking-wide text-white transition disabled:opacity-50"
        >
          {pending ? "Saving…" : "Continue"}
        </button>
      </form>
    </div>
  );
}

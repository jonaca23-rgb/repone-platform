"use client";

import { type FormEvent, startTransition, useActionState } from "react";
import type { FormResult } from "@/lib/actions/inviteResult";

type FormAction = (previous: FormResult, formData: FormData) => Promise<FormResult>;
type ButtonAction = (previous: FormResult) => Promise<FormResult>;

function Message({ state }: { state: FormResult }) {
  if (!state) return null;
  return (
    <p role="status" className={`text-sm ${state.ok ? "text-green-700" : "text-repone-red"}`}>
      {state.message}
    </p>
  );
}

/**
 * Invite by email (the Team page, an event's staff sections), with the result
 * shown inline. Submitted through the action by hand rather than as <form
 * action>: React resets a form's uncontrolled fields after its action runs,
 * which would wipe what was typed when the action returns an error.
 */
export function InviteByEmailForm({
  action,
  roles,
  showRoleLabel = false,
}: {
  action: FormAction;
  /** Org roles to choose from (the Team page); omitted for an event section. */
  roles?: { value: string; label: string }[];
  /** The commentator's on-air role. */
  showRoleLabel?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            name="email"
            required
            placeholder="name@example.com"
            className="rounded-md border border-black/20 px-3 py-2"
          />
        </label>
        {roles && (
          <label className="flex flex-col gap-1 text-sm">
            Role
            <select name="role" required className="rounded-md border border-black/20 px-3 py-2">
              {roles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {showRoleLabel && (
          <label className="flex flex-col gap-1 text-sm">
            Role label (optional)
            <select name="roleLabel" className="rounded-md border border-black/20 px-3 py-2">
              <option value="">—</option>
              <option value="main_commentator">Main Commentator</option>
              <option value="co_commentator">Co-Commentator</option>
              <option value="sideline_reporter">Sideline Reporter</option>
              <option value="interviewer">Interviewer</option>
            </select>
          </label>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-repone-red px-4 py-2 font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Inviting…" : "Invite"}
        </button>
      </form>
      <Message state={state} />
    </div>
  );
}

/** A one-click action (Resend, remove a role) with its result shown beside it. */
export function InlineActionButton({
  action,
  label,
  ariaLabel,
  className = "text-sm text-repone-red hover:underline",
}: {
  action: ButtonAction;
  label: string;
  ariaLabel?: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <span className="inline-flex items-center gap-2">
      <form action={formAction} className="inline">
        <button type="submit" disabled={pending} aria-label={ariaLabel} className={className}>
          {label}
        </button>
      </form>
      <Message state={state} />
    </span>
  );
}

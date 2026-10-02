"use client";

import { type FormEvent, startTransition, useActionState, useId } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FormResult } from "@/lib/actions/inviteResult";
import { NONE } from "@/lib/validation/none";

type FormAction = (previous: FormResult, formData: FormData) => Promise<FormResult>;
type ButtonAction = (previous: FormResult) => Promise<FormResult>;

function Message({ state }: { state: FormResult }) {
  if (!state) return null;
  return (
    <p role="status" className={`text-sm ${state.ok ? "text-success-text" : "text-destructive"}`}>
      {state.message}
    </p>
  );
}

/**
 * Invite by email (the Members page, an event's staff sections), with the
 * result shown inline. Submitted through the action by hand rather than as
 * <form action>: React resets a form's uncontrolled fields after its action
 * runs, which would wipe what was typed when the action returns an error.
 */
export function InviteByEmailForm({
  action,
  roles,
  showRoleLabel = false,
}: {
  action: FormAction;
  /** Org roles to choose from (the Members page); omitted for an event section. */
  roles?: { value: string; label: string }[];
  /** The commentator's on-air role. */
  showRoleLabel?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const id = useId();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
        <div className="grid gap-2">
          <Label htmlFor={`${id}-email`}>Email</Label>
          <Input
            id={`${id}-email`}
            type="email"
            name="email"
            required
            placeholder="name@example.com"
            className="w-64 text-base"
          />
        </div>
        {roles && (
          <div className="grid gap-2">
            <Label htmlFor={`${id}-role`}>Role</Label>
            <Select name="role" required defaultValue={roles[0]?.value}>
              <SelectTrigger id={`${id}-role`} className="min-w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {showRoleLabel && (
          <div className="grid gap-2">
            <Label htmlFor={`${id}-role-label`}>Role label (optional)</Label>
            <Select name="roleLabel" defaultValue={NONE}>
              <SelectTrigger id={`${id}-role-label`} className="min-w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                <SelectItem value="main_commentator">Main Commentator</SelectItem>
                <SelectItem value="co_commentator">Co-Commentator</SelectItem>
                <SelectItem value="sideline_reporter">Sideline Reporter</SelectItem>
                <SelectItem value="interviewer">Interviewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Inviting…" : "Invite"}
        </Button>
      </form>
      <Message state={state} />
    </div>
  );
}

/** A one-click, harmless action (Resend) with its result shown beside it. */
export function InlineActionButton({
  action,
  label,
  ariaLabel,
}: {
  action: ButtonAction;
  label: string;
  ariaLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <span className="inline-flex items-center gap-2">
      <form action={formAction} className="inline">
        <Button type="submit" variant="link" size="sm" disabled={pending} aria-label={ariaLabel}>
          {label}
        </Button>
      </form>
      <Message state={state} />
    </span>
  );
}

/**
 * A removal that returns a FormResult (remove a member's role), behind the
 * confirm dialog: a refusal stays in the dialog as an error, success toasts.
 */
export function ConfirmFormResultAction({
  action,
  trigger,
  title,
  description,
  confirmLabel,
}: {
  action: ButtonAction;
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
}) {
  return (
    <ConfirmAction
      trigger={trigger}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      onConfirm={async () => {
        const result = await action(undefined);
        if (result && !result.ok) throw new Error(result.message);
        if (result?.message) toast.success(result.message);
      }}
    />
  );
}

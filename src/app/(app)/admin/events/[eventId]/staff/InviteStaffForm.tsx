"use client";

import { useState } from "react";
import { inviteEventStaff } from "@/lib/actions/eventStaff";
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
import {
  COMMENTATOR_LABELS,
  STAFF_ROLE_ACCESS,
  STAFF_ROLE_OPTIONS,
  type StaffRole,
} from "./staffRoles";

/** Invites someone by email to one role on this event only. */
export function InviteStaffForm({ eventId, close }: { eventId: string; close: () => void }) {
  const [role, setRole] = useState<StaffRole>("scorekeeper");
  // The server says what happened ("Invitation sent." / "Access granted and notified.").
  const invite = useServerAction((fd: FormData) => inviteEventStaff(role, eventId, fd), {
    toastErrors: false,
    onSuccess: close,
  });
  const errors = fieldErrorsOf(invite.error);
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        invite.mutate(new FormData(e.currentTarget));
      }}
    >
      <FormField label="Email" name="email" errors={errors?.email}>
        {(c) => (
          <Input {...c} type="email" required autoComplete="email" placeholder="name@example.com" />
        )}
      </FormField>
      <FormField label="Role" name="staff_role" description={STAFF_ROLE_ACCESS[role]}>
        {({ name, ...c }) => (
          <Select name={name} value={role} onValueChange={(v) => setRole(v as StaffRole)}>
            <SelectTrigger {...c} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STAFF_ROLE_OPTIONS.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>
      {role === "commentator" ? (
        <FormField label="On-air role (optional)" name="roleLabel" errors={errors?.roleLabel}>
          {({ name, ...c }) => (
            <Select name={name} defaultValue={NONE}>
              <SelectTrigger {...c} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {COMMENTATOR_LABELS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
      ) : null}
      <FormAlert error={invite.error} />
      <SubmitButton pending={invite.isPending} pendingLabel="Inviting…">
        Send invitation
      </SubmitButton>
    </form>
  );
}

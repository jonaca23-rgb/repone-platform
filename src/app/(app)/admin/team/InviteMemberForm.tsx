"use client";

import { inviteTeamMember } from "@/lib/actions/team";
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
import { INVITABLE_ROLES, ROLE_LABEL } from "./roles";

/** Invites someone to the organization with one role; lives in the Invite member dialog. */
export function InviteMemberForm({ close }: { close: () => void }) {
  // The server says what happened ("Invitation sent." / "Access granted and notified.").
  const invite = useServerAction(inviteTeamMember, { toastErrors: false, onSuccess: close });
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
      <FormField label="Role" name="role" errors={errors?.role}>
        {({ name, ...c }) => (
          <Select name={name} defaultValue={INVITABLE_ROLES[0]}>
            <SelectTrigger {...c} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INVITABLE_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>
      <FormAlert error={invite.error} />
      <SubmitButton pending={invite.isPending} pendingLabel="Inviting…">
        Send invitation
      </SubmitButton>
    </form>
  );
}

"use client";

import { useState } from "react";
import { Star, X } from "lucide-react";
import { addTeamMember, removeTeamMember, setTeamCaptain } from "@/lib/actions/teams";
import { fieldErrorsOf, useServerAction } from "@/lib/use-server-action";
import { FormAlert } from "@/components/app/FormAlert";
import { FormField } from "@/components/app/FormField";
import { SubmitButton } from "@/components/app/SubmitButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type RosterMember = { memberId: string; athleteId: string; name: string };
export type RosterOption = { id: string; label: string };

/**
 * A team's roster: who is on it, who its captain is, and adding athletes who
 * aren't on a team in this event yet. It stays open after each change so a
 * whole team can be put together in one go.
 */
export function RosterDialog({
  eventId,
  team,
  available,
}: {
  eventId: string;
  team: {
    id: string;
    name: string;
    size: number | null;
    captainId: string | null;
    roster: RosterMember[];
  };
  available: RosterOption[];
}) {
  // Bumped after each add so the select starts empty again.
  const [added, setAdded] = useState(0);
  const add = useServerAction((fd: FormData) => addTeamMember(eventId, team.id, fd), {
    success: "Added to the team",
    toastErrors: false,
    onSuccess: () => setAdded((n) => n + 1),
  });
  const remove = useServerAction((memberId: string) =>
    removeTeamMember(eventId, team.id, memberId),
  );
  const captain = useServerAction((athleteId: string | null) =>
    setTeamCaptain(eventId, team.id, athleteId),
  );
  const errors = fieldErrorsOf(add.error);
  const full = team.size !== null && team.roster.length >= team.size;
  const busy = remove.isPending || captain.isPending;

  return (
    <div className="grid gap-6">
      {team.roster.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {team.roster.map((m) => {
            const isCaptain = team.captainId === m.athleteId;
            return (
              <li key={m.memberId} className="flex min-h-14 flex-wrap items-center gap-2 px-3 py-2">
                <span className="min-w-0 flex-1 font-semibold">{m.name}</span>
                {isCaptain ? <Badge variant="outline">Captain</Badge> : null}
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={busy}
                  aria-pressed={isCaptain}
                  onClick={() => captain.mutate(isCaptain ? null : m.athleteId)}
                >
                  <Star aria-hidden />
                  {isCaptain ? "Remove as captain" : "Make captain"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  disabled={busy}
                  aria-label={`Remove ${m.name} from ${team.name}`}
                  onClick={() => remove.mutate(m.memberId)}
                >
                  <X aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No one on this team yet.</p>
      )}

      {full ? (
        <p className="text-sm text-muted-foreground">
          This team is complete: its division takes {team.size} per team.
        </p>
      ) : available.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Every athlete of the organization is already on a team in this event.
        </p>
      ) : (
        <form
          key={added}
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate(new FormData(e.currentTarget));
          }}
        >
          <FormField
            label="Add athlete"
            name="athlete_id"
            errors={errors?.athlete_id}
            description="Athletes who aren't on a team in this event yet."
          >
            {({ name, ...c }) => (
              <Select name={name} required>
                <SelectTrigger {...c} className="w-full">
                  <SelectValue placeholder="Choose an athlete" />
                </SelectTrigger>
                <SelectContent>
                  {available.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <FormAlert error={add.error} />
          <SubmitButton pending={add.isPending} pendingLabel="Adding…">
            Add to team
          </SubmitButton>
        </form>
      )}
    </div>
  );
}

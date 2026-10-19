"use client";

import { useId, useRef, useState } from "react";
import { Plus, Star, X } from "lucide-react";
import { addTeamMember, removeTeamMember, setTeamCaptain } from "@/lib/actions/teams";
import { useServerAction } from "@/lib/use-server-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type RosterMember = { memberId: string; athleteId: string; name: string };
export type RosterOption = { id: string; label: string };

/** "Sofía" → "sofia": a search that ignores case and accents. */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * A team's roster: who is on it, who its captain is, and adding athletes who
 * aren't on a team in this event yet, found by name or affiliate so a large
 * organization still fits. It stays open after each change so a
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
  const searchId = useId();
  const hintId = useId();
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const add = useServerAction((fd: FormData) => addTeamMember(eventId, team.id, fd), {
    success: "Added to the team",
    toastErrors: false,
    // The athlete just added leaves the list; the search takes the focus
    // back, ready for the next teammate.
    onSuccess: () => {
      setQuery("");
      searchRef.current?.focus();
    },
  });
  const remove = useServerAction((memberId: string) =>
    removeTeamMember(eventId, team.id, memberId),
  );
  const captain = useServerAction((athleteId: string | null) =>
    setTeamCaptain(eventId, team.id, athleteId),
  );
  const needle = fold(query.trim());
  const matches = available.filter((a) => fold(a.label).includes(needle));
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
        <div className="grid gap-2">
          <Label htmlFor={searchId}>Find an athlete</Label>
          <Input
            ref={searchRef}
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name or affiliate"
            autoComplete="off"
            aria-describedby={hintId}
          />
          <p id={hintId} className="text-sm text-muted-foreground">
            Athletes who aren&apos;t on a team in this event yet. Tap one to add them.
          </p>
          {matches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No athlete matches “{query.trim()}”.</p>
          ) : (
            <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {matches.map((a) => (
                <li key={a.id}>
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11 w-full justify-start rounded-none"
                    disabled={add.isPending}
                    aria-label={`Add ${a.label}`}
                    onClick={() => {
                      const fd = new FormData();
                      fd.set("athlete_id", a.id);
                      add.mutate(fd);
                    }}
                  >
                    <Plus aria-hidden />
                    <span className="truncate">{a.label}</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {add.error ? (
            <p role="alert" className="text-sm text-destructive">
              {add.error.message}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

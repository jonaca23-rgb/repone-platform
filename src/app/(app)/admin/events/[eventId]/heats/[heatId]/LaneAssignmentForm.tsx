"use client";

import { TriangleAlert } from "lucide-react";
import { assignLane } from "@/lib/actions/lanes";
import { useServerAction } from "@/lib/use-server-action";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NONE } from "@/lib/validation/none";

/** Someone who can take a lane in this heat: one of its division's athletes or teams. */
export interface LaneOption {
  id: string;
  label: string;
}

/**
 * One lane's "who's in this lane" picker (an athlete, or a team in a team
 * division), saved on its own. A duplicate
 * comes back from `assignLane` as a result and shows as a toast plus an
 * inline message. "Empty" posts NONE, which the action reads as blank and
 * clears the lane. (One Select per lane, so FormData + zod, not TanStack Form.)
 *
 * `conflictMessage`, when set, is a pre-existing duplicate the parent Server
 * Component already detected on page load (before any save attempt) — shown
 * the same way as a fresh save error so the two look identical to the user.
 */
export function LaneAssignmentForm({
  eventId,
  heatId,
  lane,
  kind,
  options,
  conflictMessage,
}: {
  eventId: string;
  heatId: string;
  lane: { id: string; lane_number: number; occupantId: string | null };
  kind: "athlete" | "team";
  options: LaneOption[];
  conflictMessage?: string;
}) {
  const save = useServerAction((fd: FormData) => assignLane(eventId, heatId, lane.id, fd), {
    success: `Lane ${lane.lane_number} saved`,
  });
  const pending = save.isPending;
  const message = save.error?.message || conflictMessage;
  const selectId = `lane-${lane.id}`;

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(new FormData(e.currentTarget));
        }}
        className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
          message ? "border-destructive bg-destructive/10" : "border-border bg-card"
        }`}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary font-display text-base font-bold text-primary-foreground">
          {lane.lane_number}
        </span>
        <Label htmlFor={selectId} className="sr-only">
          Lane {lane.lane_number} {kind}
        </Label>
        <Select
          name={kind === "team" ? "team_id" : "athlete_id"}
          defaultValue={lane.occupantId ?? NONE}
        >
          <SelectTrigger
            id={selectId}
            aria-invalid={message ? true : undefined}
            className="min-w-0 flex-1"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Empty</SelectItem>
            {options.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={pending}
          className="max-sm:min-h-11"
        >
          {pending ? "Saving…" : "Save"}
        </Button>
      </form>
      {message && (
        <p
          role="alert"
          className="mt-1 flex items-start gap-1 pl-11 text-sm font-semibold text-destructive"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {message}
        </p>
      )}
    </div>
  );
}

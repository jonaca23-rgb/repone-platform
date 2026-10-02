"use client";

import { useActionState, useEffect, useRef } from "react";
import { TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { assignLane } from "@/lib/actions/lanes";
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

interface Registration {
  athlete_id: string | null;
  athletes: { id: string; first_name: string; last_name: string } | null;
}

/**
 * One lane's "who's in this lane" picker. A Client Component so a
 * duplicate-athlete attempt comes back as a toast and an inline message
 * instead of Next's full-page error overlay — `assignLane` returns
 * `{ error }` instead of throwing. "Empty" posts NONE, which the action reads
 * as blank and clears the lane.
 *
 * `conflictMessage`, when set, is a pre-existing duplicate the parent Server
 * Component already detected on page load (before any save attempt) — shown
 * the same way as a fresh save error so the two look identical to the user.
 */
export function LaneAssignmentForm({
  eventId,
  heatId,
  lane,
  registrations,
  conflictMessage,
}: {
  eventId: string;
  heatId: string;
  lane: { id: string; lane_number: number; athlete_id: string | null };
  registrations: Registration[];
  conflictMessage?: string;
}) {
  const [state, formAction, pending] = useActionState(
    assignLane.bind(null, eventId, heatId, lane.id),
    { error: "" },
  );
  const lastError = useRef<string>("");

  useEffect(() => {
    if (state.error && state.error !== lastError.current) {
      lastError.current = state.error;
      toast.error(state.error);
    }
  }, [state.error]);

  const message = state.error || conflictMessage;
  const selectId = `lane-${lane.id}`;

  return (
    <div>
      <form
        action={formAction}
        className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
          message ? "border-destructive bg-destructive/10" : "border-border bg-card"
        }`}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary font-display text-base font-bold text-primary-foreground">
          {lane.lane_number}
        </span>
        <Label htmlFor={selectId} className="sr-only">
          Lane {lane.lane_number} athlete
        </Label>
        <Select name="athlete_id" defaultValue={lane.athlete_id ?? NONE}>
          <SelectTrigger
            id={selectId}
            aria-invalid={message ? true : undefined}
            className="min-w-0 flex-1"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Empty</SelectItem>
            {registrations
              .filter((r) => r.athlete_id)
              .map((r) => (
                <SelectItem key={r.athlete_id} value={r.athlete_id as string}>
                  {r.athletes?.first_name} {r.athletes?.last_name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
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

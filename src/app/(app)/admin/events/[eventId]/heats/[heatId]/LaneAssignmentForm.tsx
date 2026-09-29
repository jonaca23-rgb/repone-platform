"use client";

import { useActionState, useEffect, useRef } from "react";
import { assignLane } from "@/lib/actions/lanes";

interface Registration {
  athlete_id: string | null;
  athletes: { id: string; first_name: string; last_name: string } | null;
}

/**
 * One lane's "who's in this lane" picker. A Client Component (not the plain
 * server-action `<form>` this used to be) so a duplicate-athlete attempt can
 * come back as a normal, dismissable alert instead of crashing into Next's
 * full-page error overlay with no way back to the heat — `assignLane` now
 * returns `{ error }` instead of throwing, and `useActionState` surfaces it
 * both inline (for anyone who missed the popup) and via `window.alert`.
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
    {
      error: "",
    },
  );
  const lastAlerted = useRef<string>("");

  useEffect(() => {
    if (state.error && state.error !== lastAlerted.current) {
      lastAlerted.current = state.error;
      window.alert(state.error);
    }
  }, [state.error]);

  const message = state.error || conflictMessage;

  return (
    <div>
      <form
        action={formAction}
        className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
          message ? "border-red-500 bg-red-50" : "border-black/10"
        }`}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-repone-black text-sm font-bold text-white">
          {lane.lane_number}
        </span>
        <select
          name="athlete_id"
          defaultValue={lane.athlete_id ?? ""}
          className={`flex-1 rounded-md border px-2 py-1.5 text-sm ${message ? "border-red-500" : "border-black/20"}`}
        >
          <option value="">— empty —</option>
          {registrations.map((r) => (
            <option key={r.athlete_id} value={r.athlete_id ?? ""}>
              {r.athletes?.first_name} {r.athletes?.last_name}
            </option>
          ))}
        </select>
        <button
          disabled={pending}
          className="text-xs font-semibold uppercase text-repone-red disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </form>
      {message && <p className="mt-1 pl-11 text-xs font-semibold text-red-600">⚠ {message}</p>}
    </div>
  );
}

"use client";

import { deleteEvent } from "@/lib/actions/events";

/**
 * Deleting an event wipes everything under it (divisions, registrations,
 * heats, results, standings, fees, payments) with no undo, so — unlike the
 * rest of the app's plain "Remove" buttons — this one asks first.
 */
export function DeleteEventButton({
  eventId,
  eventName,
  variant = "light",
}: {
  eventId: string;
  eventName: string;
  // "dark" is for placing this button over a dark background (e.g. the
  // Event hub's cover-photo banner) — same control, just legible there too.
  variant?: "light" | "dark";
}) {
  return (
    <form
      action={deleteEvent.bind(null, eventId)}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Delete "${eventName}"? This permanently removes its divisions, registrations, heats, results, standings, fees, and payment records. This cannot be undone.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className={
          variant === "dark"
            ? "rounded-md border border-white/30 px-3 py-1.5 text-xs font-semibold uppercase text-white/70 hover:border-repone-red hover:text-repone-red"
            : "rounded-md border border-black/20 px-3 py-1.5 text-xs font-semibold uppercase text-black/50 hover:border-repone-red hover:text-repone-red"
        }
      >
        Delete Event
      </button>
    </form>
  );
}

import { Trash2 } from "lucide-react";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { deleteEvent } from "@/lib/actions/events";

/**
 * Deleting an event wipes everything under it (divisions, registrations,
 * heats, results, standings, fees, payments) with no undo, so it asks first
 * and names what goes.
 */
export function DeleteEventButton({ eventId, eventName }: { eventId: string; eventName: string }) {
  return (
    <ConfirmAction
      trigger={
        <>
          <Trash2 aria-hidden />
          Delete event
        </>
      }
      triggerVariant="ghost"
      title={`Delete ${eventName}?`}
      description="This permanently removes its divisions, registrations, heats, results, standings, fees and payment records. This cannot be undone."
      confirmLabel="Delete event"
      onConfirm={deleteEvent.bind(null, eventId)}
    />
  );
}

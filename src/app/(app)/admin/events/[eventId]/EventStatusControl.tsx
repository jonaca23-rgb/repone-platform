"use client";

import type { EventStatus } from "@/lib/db/database.types";
import { updateEventStatus } from "@/lib/actions/events";
import { useServerAction } from "@/lib/use-server-action";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { Button } from "@/components/ui/button";

const STATUSES: EventStatus[] = ["draft", "scheduled", "live", "completed", "archived"];

const STATUS_LABEL: Record<EventStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  live: "Live",
  completed: "Completed",
  archived: "Archived",
};

// Going live puts the event in front of the public and staff; archiving takes it away.
const CONFIRMED: Partial<Record<EventStatus, string>> = {
  live: "The event shows as live on the public leaderboard and to its staff.",
  archived:
    "The event is hidden from the active lists. You can set it back to another status later.",
};

/** The event's status as a pressed button group; going live or archiving asks first. */
export function EventStatusControl({
  eventId,
  eventName,
  status,
}: {
  eventId: string;
  eventName: string;
  status: EventStatus;
}) {
  const change = useServerAction((next: EventStatus) => updateEventStatus(eventId, next), {
    success: (_data, next) => `Set to ${STATUS_LABEL[next]}`,
  });

  return (
    <div role="group" aria-label="Event status" className="flex flex-wrap items-center gap-1">
      {STATUSES.map((s) => {
        if (s === status) {
          return (
            <Button key={s} size="sm" aria-pressed="true" disabled className="disabled:opacity-100">
              {STATUS_LABEL[s]}
            </Button>
          );
        }
        const consequence = CONFIRMED[s];
        return consequence ? (
          <ConfirmAction
            key={s}
            trigger={STATUS_LABEL[s]}
            triggerVariant="outline"
            variant="default"
            title={`Set ${eventName} to ${STATUS_LABEL[s]}?`}
            description={consequence}
            confirmLabel={`Set to ${STATUS_LABEL[s]}`}
            onConfirm={() => updateEventStatus(eventId, s)}
          />
        ) : (
          <Button
            key={s}
            size="sm"
            variant="outline"
            aria-pressed="false"
            disabled={change.isPending}
            onClick={() => change.mutate(s)}
          >
            {STATUS_LABEL[s]}
          </Button>
        );
      })}
    </div>
  );
}

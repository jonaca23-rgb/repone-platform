"use client";

import { useState } from "react";
import { MapPinOff } from "lucide-react";
import { CommentatorClient } from "@/app/(app)/commentator/[floorId]/CommentatorClient";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import type { CommentatorAthleteDetails } from "@/lib/db/commentator";
import type { EventLiveFloor } from "@/lib/db/queries";

// The event-level Commentator Dashboard (per Jonathan's route spec,
// /commentator/events/[eventId]/dashboard): floor selection becomes an
// in-page toggle instead of a separate route/page, since most events run one
// floor at a time — an event with several simultaneous floors gets a
// lightweight button row here rather than a URL segment. Everything below
// it is the same, already-built CommentatorClient used by the
// standalone /commentator/[floorId] route, just with its own
// "choose a different floor" link hidden (the event tabs and the top bar
// already lead back out).
export function EventCommentatorDashboard({
  floors,
  detailsByAthleteId,
}: {
  floors: EventLiveFloor[];
  detailsByAthleteId: Record<string, CommentatorAthleteDetails>;
}) {
  const [selectedFloorId, setSelectedFloorId] = useState(floors[0]?.floorId ?? null);
  const selectedFloor = floors.find((f) => f.floorId === selectedFloorId) ?? floors[0] ?? null;

  if (!selectedFloor) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <EmptyState icon={MapPinOff} title="No floors set up for this event yet" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {floors.length > 1 && (
        <div
          role="group"
          aria-label="Floor"
          className="mx-auto flex w-full max-w-5xl flex-wrap gap-2 px-4 pt-6"
        >
          {floors.map((f) => {
            const selected = f.floorId === selectedFloor.floorId;
            return (
              <Button
                key={f.floorId}
                type="button"
                size="touch"
                variant={selected ? "default" : "secondary"}
                aria-pressed={selected}
                onClick={() => setSelectedFloorId(f.floorId)}
              >
                {f.venueName} — {f.floorName}
              </Button>
            );
          })}
        </div>
      )}
      <CommentatorClient
        floorId={selectedFloor.floorId}
        heats={selectedFloor.heats}
        initialBroadcastState={selectedFloor.initialBroadcastState}
        detailsByAthleteId={detailsByAthleteId}
        hideBackLink
      />
    </div>
  );
}

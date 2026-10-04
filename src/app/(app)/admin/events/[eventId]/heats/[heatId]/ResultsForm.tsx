"use client";

import { useRouter } from "next/navigation";
import type { ScoringTypeDb } from "@/lib/db/database.types";
import { saveHeatResults } from "@/lib/actions/results";
import { useServerAction } from "@/lib/use-server-action";
import { SubmitButton } from "@/components/app/SubmitButton";

/**
 * The heat's backup results entry: every lane's inputs (rendered by the page)
 * in one form, saved together, then back to the heats list as before.
 * Failures toast, since a lane's inputs are named "<field>__<athleteId>".
 */
export function ResultsForm({
  eventId,
  heatId,
  wodId,
  divisionId,
  scoringType,
  floorId,
  athleteIds,
  children,
}: {
  eventId: string;
  heatId: string;
  wodId: string;
  divisionId: string;
  scoringType: ScoringTypeDb;
  floorId: string | null;
  athleteIds: string[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const save = useServerAction(
    (fd: FormData) =>
      saveHeatResults(eventId, heatId, wodId, divisionId, scoringType, floorId, athleteIds, fd),
    { success: "Results saved", refresh: false, onSuccess: (data) => router.push(data.href) },
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(new FormData(e.currentTarget));
      }}
    >
      {children}
      {athleteIds.length > 0 ? (
        <div className="mt-4">
          <SubmitButton pending={save.isPending} pendingLabel="Saving…">
            Save all
          </SubmitButton>
        </div>
      ) : null}
    </form>
  );
}

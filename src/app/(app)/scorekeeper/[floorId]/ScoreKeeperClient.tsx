"use client";

import { useId, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ListOrdered,
  PencilLine,
  Radio,
  Users,
} from "lucide-react";
import { useBroadcastState } from "@/lib/realtime/useBroadcastState";
import { floorWatches } from "@/lib/realtime/floorWatches";
import { useRefreshOnChanges } from "@/lib/realtime/useRefreshOnChanges";
import { enterResult } from "@/lib/actions/results";
import { finishHeat } from "@/lib/actions/heats";
import { formatClock } from "@/lib/timer/compute";
import type { Database } from "@/lib/db/database.types";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { EmptyState } from "@/components/app/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export interface ScoreKeeperHeat {
  id: string;
  heatNumber: number;
  heatCount: number | null;
  endedAt: string | null;
  wod: { id: string; name: string; scoring_type: string; time_cap_seconds: number | null };
  division: { id: string; name: string };
  lanes: Array<{
    laneNumber: number;
    athleteId: string | null;
    name: string | null;
    affiliate: string | null;
  }>;
}

export interface ScoreKeeperResult {
  athlete_id: string | null;
  time_seconds: number | null;
  reps: number | null;
  load: number | null;
  points: number | null;
  capped: boolean;
  status: "completed" | "dns" | "dnf" | "dq";
  tiebreak_value: number | null;
  manually_adjusted: boolean;
}

export interface ScoreKeeperStanding {
  placement: number | null;
  points: number | null;
  athlete_id: string | null;
  name: string;
}

type BroadcastStateRow = Database["public"]["Tables"]["broadcast_state"]["Row"];
type ScoringType = "for_time" | "amrap" | "max_load" | "points" | "other";

/** Where the scorekeeper asked to go while the current heat has unsaved lanes. */
type LeaveTarget = { kind: "heat"; id: string } | { kind: "follow" };

const SUCCESS_BADGE = "border-success/40 bg-success/10 text-success-text";
const WARNING_BADGE = "border-warning/40 bg-warning/10 text-warning-text";
const FIELD_LABEL = "text-xs uppercase tracking-wide text-muted-foreground";

// Separate component so `useFormStatus` can read the enclosing <form>'s
// pending state — disables the button to guard against double-submission
// while a save is in flight (reliability requirement from the platform spec).
function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="touch" disabled={pending}>
      {pending ? "Saving…" : "Save score"}
    </Button>
  );
}

/**
 * One lane's scorecard, matching the judge's fields for this WOD's scoring
 * type. Field names are what enterResult reads: competitor_type,
 * competitor_id, time_seconds, capped, reps, load, points, tiebreak_value,
 * status, manual_adjustment.
 */
function LaneScoreForm({
  lane,
  existing,
  scoringType,
  isUnsaved,
  error,
  save,
  onEdit,
  onSaved,
  onFailed,
}: {
  lane: ScoreKeeperHeat["lanes"][number];
  existing: ScoreKeeperResult | undefined;
  scoringType: ScoringType;
  isUnsaved: boolean;
  error: string | undefined;
  save: (formData: FormData) => Promise<void>;
  onEdit: () => void;
  onSaved: () => void;
  onFailed: () => void;
}) {
  const id = useId();
  const status = existing?.status ?? "completed";
  const capped = existing?.capped ?? false;
  const adjusted = existing?.manually_adjusted ?? false;

  return (
    <Card size="sm">
      <CardContent>
        <form
          // onInput, not onChange: the browser also fires "change" when a
          // focused field loses focus after its value was replaced by the
          // saved one (Enter to save, then click Finish), which would
          // re-mark a saved lane as unsaved. The Switches and the Select
          // don't fire "input", so they call onEdit themselves.
          onInput={onEdit}
          action={async (formData) => {
            try {
              await save(formData);
              onSaved();
            } catch {
              onFailed();
            }
          }}
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="competitor_type" value="athlete" />
          <input type="hidden" name="competitor_id" value={lane.athleteId ?? ""} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex min-w-0 items-center gap-2 font-semibold tracking-wide uppercase">
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded bg-primary text-sm font-bold text-primary-foreground">
                {lane.laneNumber}
              </span>
              <span className="truncate">{lane.name}</span>
            </p>
            <span className="flex flex-wrap items-center gap-2">
              {isUnsaved && (
                <Badge variant="outline" className={WARNING_BADGE}>
                  <CircleDot aria-hidden />
                  Unsaved
                </Badge>
              )}
              {existing && !isUnsaved && (
                <Badge variant="outline" className={SUCCESS_BADGE}>
                  <Check aria-hidden />
                  Recorded
                </Badge>
              )}
              {existing?.manually_adjusted && (
                <Badge variant="outline" className={WARNING_BADGE}>
                  <PencilLine aria-hidden />
                  Adjusted
                </Badge>
              )}
            </span>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            {scoringType === "for_time" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor={`${id}-time`} className={FIELD_LABEL}>
                    Time (mm:ss)
                  </Label>
                  {/* Text keypad, not decimal: a phone's decimal keypad has no colon. */}
                  <Input
                    id={`${id}-time`}
                    name="time_seconds"
                    type="text"
                    inputMode="text"
                    pattern="[0-9]{1,3}:[0-5][0-9]"
                    title="Minutes:seconds, e.g. 3:45"
                    placeholder="3:45"
                    autoComplete="off"
                    defaultValue={
                      existing?.time_seconds != null ? formatClock(existing.time_seconds) : ""
                    }
                    className="h-12 w-32 text-base"
                  />
                </div>
                <div className="flex min-h-12 items-center gap-3">
                  {/* Keyed to the saved value: a form reset after Save puts the
                      switch back to its first value, which must be the saved one. */}
                  <Switch
                    key={String(capped)}
                    id={`${id}-capped`}
                    name="capped"
                    defaultChecked={capped}
                    onCheckedChange={onEdit}
                  />
                  <Label htmlFor={`${id}-capped`} className={FIELD_LABEL}>
                    Time-capped
                  </Label>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`${id}-reps`} className={FIELD_LABEL}>
                    Reps (if capped)
                  </Label>
                  <Input
                    id={`${id}-reps`}
                    name="reps"
                    type="number"
                    inputMode="numeric"
                    defaultValue={existing?.reps ?? ""}
                    className="h-12 w-28 text-base"
                  />
                </div>
              </>
            )}
            {scoringType === "amrap" && (
              <div className="grid gap-2">
                <Label htmlFor={`${id}-reps`} className={FIELD_LABEL}>
                  Total reps
                </Label>
                <Input
                  id={`${id}-reps`}
                  name="reps"
                  type="number"
                  inputMode="numeric"
                  defaultValue={existing?.reps ?? ""}
                  className="h-12 w-28 text-base"
                />
              </div>
            )}
            {scoringType === "max_load" && (
              <div className="grid gap-2">
                <Label htmlFor={`${id}-load`} className={FIELD_LABEL}>
                  Load
                </Label>
                <Input
                  id={`${id}-load`}
                  name="load"
                  type="number"
                  step="0.5"
                  inputMode="decimal"
                  defaultValue={existing?.load ?? ""}
                  className="h-12 w-28 text-base"
                />
              </div>
            )}
            {(scoringType === "points" || scoringType === "other") && (
              <div className="grid gap-2">
                <Label htmlFor={`${id}-points`} className={FIELD_LABEL}>
                  Points
                </Label>
                <Input
                  id={`${id}-points`}
                  name="points"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  defaultValue={existing?.points ?? ""}
                  className="h-12 w-28 text-base"
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor={`${id}-tiebreak`} className={FIELD_LABEL}>
                Tie-break
              </Label>
              <Input
                id={`${id}-tiebreak`}
                name="tiebreak_value"
                type="number"
                step="0.01"
                inputMode="decimal"
                defaultValue={existing?.tiebreak_value ?? ""}
                className="h-12 w-28 text-base"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${id}-status`} className={FIELD_LABEL}>
                Status
              </Label>
              {/* Keyed to the saved value for the same reason as the switches. */}
              <Select key={status} name="status" defaultValue={status} onValueChange={onEdit}>
                <SelectTrigger id={`${id}-status`} className="w-36 data-[size=default]:h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="dnf">DNF</SelectItem>
                  <SelectItem value="dns">DNS</SelectItem>
                  <SelectItem value="dq">DQ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div
              className="flex min-h-12 items-center gap-3"
              title="Turn this on when correcting a result after the fact (e.g. a claim/protest resolved after the heat) — the record will be marked as manually adjusted."
            >
              <Switch
                key={String(adjusted)}
                id={`${id}-adjust`}
                name="manual_adjustment"
                defaultChecked={adjusted}
                onCheckedChange={onEdit}
              />
              <Label
                htmlFor={`${id}-adjust`}
                className="text-xs tracking-wide text-warning-text uppercase"
              >
                Manual adjustment
              </Label>
            </div>
            <SaveButton />
          </div>
          {error && (
            <p role="alert" className="text-sm font-semibold text-destructive">
              {error}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

export function ScoreKeeperClient({
  floorId,
  eventId,
  heats,
  initialBroadcastState,
  resultsByHeatId,
  standingsByHeatId,
}: {
  floorId: string;
  eventId: string;
  heats: ScoreKeeperHeat[];
  initialBroadcastState: BroadcastStateRow | null;
  resultsByHeatId: Record<string, ScoreKeeperResult[]>;
  standingsByHeatId: Record<string, ScoreKeeperStanding[]>;
}) {
  const { state, connected } = useBroadcastState(floorId, initialBroadcastState);
  const liveHeatId = state?.current_heat_id ?? null;
  // A second scorekeeper's saves (results) and lane changes from Admin show up
  // here without a reload; values being typed are kept across the refresh.
  useRefreshOnChanges(
    floorWatches(
      floorId,
      heats.map((h) => h.id),
      { results: true },
    ),
  );

  // By default the scorekeeper's screen follows whatever heat Production has
  // live on the Dashboard (heat/lane automation from the spec) — but they can
  // switch to any heat manually (e.g. to fix an earlier score) without losing
  // that live link; "Follow live heat" brings them back to it.
  const [following, setFollowing] = useState(true);
  const [manualHeatId, setManualHeatId] = useState<string | null>(null);

  // Lanes with typed-but-unsaved values, as "heatId:laneNumber". While any
  // exist, following the live heat stays pinned to the heat being typed into:
  // otherwise a heat change from Production would swap the athlete under a
  // half-typed score.
  const [unsaved, setUnsaved] = useState<Set<string>>(() => new Set());
  const [laneErrors, setLaneErrors] = useState<Record<string, string>>({});
  // A heat change asked for while this heat has unsaved lanes, waiting on the dialog.
  const [leaveTo, setLeaveTo] = useState<LeaveTarget | null>(null);
  const pinnedHeatId = unsaved.size > 0 ? [...unsaved][0].split(":")[0] : null;
  const markLane = (key: string, isUnsaved: boolean) =>
    setUnsaved((prev) => {
      if (prev.has(key) === isUnsaved) return prev;
      const next = new Set(prev);
      if (isUnsaved) next.add(key);
      else next.delete(key);
      return next;
    });

  const activeHeatId = following
    ? (pinnedHeatId ?? liveHeatId ?? heats[0]?.id ?? null)
    : (manualHeatId ?? heats[0]?.id ?? null);
  const heat = heats.find((h) => h.id === activeHeatId) ?? heats[0] ?? null;
  const liveHeat = heats.find((h) => h.id === liveHeatId) ?? null;
  const heldBack = following && pinnedHeatId !== null && liveHeat && liveHeat.id !== pinnedHeatId;

  // Manual "Previous heat" / "Next heat" step through this floor's heats in
  // the same order as the picker above — steps off "Follow live heat" the
  // same way picking a heat from the dropdown does.
  const heatIndex = heat ? heats.findIndex((h) => h.id === heat.id) : -1;
  const unsavedInHeat = heat ? [...unsaved].filter((k) => k.startsWith(`${heat.id}:`)).length : 0;

  // Leaving a heat drops its unsaved values (each lane's form is keyed to its
  // heat), so the dialog asks first when there are any.
  const leave = (target: LeaveTarget) => {
    setUnsaved(new Set());
    if (target.kind === "heat") {
      setFollowing(false);
      setManualHeatId(target.id);
    } else {
      setFollowing(true);
      setManualHeatId(null);
    }
  };
  const requestLeave = (target: LeaveTarget) => {
    if (unsavedInHeat === 0) leave(target);
    else setLeaveTo(target);
  };

  const resultByAthlete = useMemo(() => {
    const map = new Map<string, ScoreKeeperResult>();
    (heat ? (resultsByHeatId[heat.id] ?? []) : []).forEach((r) => {
      if (r.athlete_id) map.set(r.athlete_id, r);
    });
    return map;
  }, [heat, resultsByHeatId]);

  const standings = heat ? (standingsByHeatId[heat.id] ?? []) : [];

  if (!heat) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState
          icon={ListOrdered}
          title="No heats scheduled on this floor yet"
          description="Set them up in Admin → Heats & Lanes."
        />
      </div>
    );
  }

  const scoringType = heat.wod.scoring_type as ScoringType;
  const lanesWithAthletes = heat.lanes.filter((l) => l.athleteId);
  const withoutResult = lanesWithAthletes.filter((l) => !resultByAthlete.has(l.athleteId!)).length;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-4 sm:gap-6 sm:py-6">
      {/* Header */}
      <Card size="sm">
        <CardContent className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 font-display text-2xl font-bold tracking-wide uppercase">
              {heat.wod.name} · Heat {heat.heatNumber}
              {heat.heatCount ? ` / ${heat.heatCount}` : ""}
              {heat.endedAt && (
                <Badge variant="outline" className={SUCCESS_BADGE}>
                  <Check aria-hidden />
                  Finished
                </Badge>
              )}
            </h1>
            <p className="text-sm font-semibold tracking-wide text-brand-text uppercase">
              {heat.division.name}
            </p>
          </div>
          <span aria-live="polite" className="flex items-center gap-2 text-sm font-medium">
            <span
              aria-hidden
              className={cn(
                "size-3 rounded-full",
                connected ? "bg-success" : "animate-pulse bg-primary",
              )}
            />
            {connected ? "Live" : "Reconnecting…"}
          </span>
        </CardContent>
      </Card>

      {/* Heat picker */}
      <Card size="sm">
        <CardContent className="flex flex-row flex-wrap items-end gap-3">
          <div className="grid min-w-0 flex-1 basis-56 grid-cols-[minmax(0,1fr)] gap-2">
            <Label htmlFor="scorekeeper-heat" className={FIELD_LABEL}>
              Heat
            </Label>
            <Select value={heat.id} onValueChange={(id) => requestLeave({ kind: "heat", id })}>
              <SelectTrigger id="scorekeeper-heat" className="w-full data-[size=default]:h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {heats.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.wod.name} — Heat {h.heatNumber} ({h.division.name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="touch"
              className="gap-2 px-4"
              disabled={heatIndex <= 0}
              onClick={() =>
                heatIndex > 0 && requestLeave({ kind: "heat", id: heats[heatIndex - 1].id })
              }
            >
              <ChevronLeft aria-hidden />
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="touch"
              className="gap-2 px-4"
              disabled={heatIndex === -1 || heatIndex >= heats.length - 1}
              onClick={() =>
                heatIndex >= 0 &&
                heatIndex < heats.length - 1 &&
                requestLeave({ kind: "heat", id: heats[heatIndex + 1].id })
              }
            >
              Next
              <ChevronRight aria-hidden />
            </Button>
          </div>
          {following ? (
            <span className="flex min-h-12 items-center gap-2 text-xs font-semibold tracking-wide text-brand-text uppercase">
              <Radio className="size-4" aria-hidden />
              Following live heat
            </span>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="touch"
              className="gap-2 px-4"
              onClick={() => requestLeave({ kind: "follow" })}
            >
              <Radio aria-hidden />
              Follow live heat
            </Button>
          )}
        </CardContent>
      </Card>

      <ConfirmAction
        open={leaveTo !== null}
        onOpenChange={(open) => {
          if (!open) setLeaveTo(null);
        }}
        title="Leave this heat?"
        description={`${unsavedInHeat} lane${unsavedInHeat === 1 ? " has" : "s have"} unsaved values. Leaving this heat discards them.`}
        confirmLabel="Leave heat"
        onConfirm={async () => {
          if (leaveTo) leave(leaveTo);
        }}
      />

      {heldBack && (
        <p
          role="status"
          className="rounded-xl border border-warning/40 bg-warning/10 px-5 py-3 text-sm text-warning-text"
        >
          Production moved to {liveHeat.wod.name} · Heat {liveHeat.heatNumber}. Staying on this heat
          until its unsaved lanes are saved.
        </p>
      )}

      {/* Score entry — one card per lane, matching the judge's scorecard fields for this WOD's scoring type */}
      <div className="flex flex-col gap-3">
        {lanesWithAthletes.map((lane) => {
          const laneKey = `${heat.id}:${lane.laneNumber}`;
          return (
            <LaneScoreForm
              // Keyed to heat + athlete, never just the lane number: a form
              // must not survive into another heat with the old values.
              key={`${laneKey}:${lane.athleteId}`}
              lane={lane}
              existing={resultByAthlete.get(lane.athleteId!)}
              scoringType={scoringType}
              isUnsaved={unsaved.has(laneKey)}
              error={laneErrors[laneKey]}
              save={enterResult.bind(
                null,
                eventId,
                heat.id,
                heat.wod.id,
                heat.division.id,
                scoringType,
                floorId,
              )}
              onEdit={() => markLane(laneKey, true)}
              onSaved={() => {
                markLane(laneKey, false);
                setLaneErrors((prev) => {
                  const next = { ...prev };
                  delete next[laneKey];
                  return next;
                });
              }}
              onFailed={() =>
                setLaneErrors((prev) => ({
                  ...prev,
                  [laneKey]:
                    "Not saved. Check the value and the connection, then press Save score again.",
                }))
              }
            />
          );
        })}
        {lanesWithAthletes.length === 0 && (
          <EmptyState
            icon={Users}
            title="No athletes in lanes for this heat yet"
            description="Set that up in Admin → Heats & Lanes."
          />
        )}
      </div>

      {/* Finish this heat — scores above are saved lane by lane; this only
          flips the heat's status (Completed on Heats & Lanes) and, once the
          WOD's last heat is finished, makes missing results count as last in
          the overall standings. Finishing never saves anything, so it
          refuses while any lane has typed-but-unsaved values. */}
      {lanesWithAthletes.length > 0 && (
        <Card size="sm">
          <CardContent className="flex flex-row flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {heat.endedAt
                ? "This heat is marked completed."
                : "Save every lane above, then finish this heat."}
            </p>
            {heat.endedAt || unsavedInHeat > 0 ? (
              <Button type="button" size="touch" disabled>
                {heat.endedAt
                  ? "Heat finished"
                  : `Save ${unsavedInHeat} unsaved lane${unsavedInHeat === 1 ? "" : "s"} first`}
              </Button>
            ) : (
              <ConfirmAction
                trigger="Finish heat"
                triggerVariant="default"
                triggerSize="touch"
                variant="default"
                title={`Finish Heat ${heat.heatNumber}?`}
                description={`${heat.wod.name} (${heat.division.name}) is marked completed.${
                  withoutResult > 0
                    ? ` ${withoutResult} lane${withoutResult === 1 ? " has" : "s have"} no result and will count as last once the WOD is finished.`
                    : ""
                }`}
                confirmLabel="Finish heat"
                onConfirm={() => finishHeat(eventId, heat.id, floorId)}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Live leaderboard for this heat's WOD/division — updates the moment a score is saved */}
      {standings.length > 0 && (
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
              Live leaderboard — {heat.wod.name} ({heat.division.name})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-1">
              {standings.map((s, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 rounded-lg bg-muted px-4 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="mr-3 font-bold text-brand-text">{s.placement ?? "—"}</span>
                    {s.name}
                  </span>
                  <span className="shrink-0 font-semibold">{s.points ?? "—"} pts</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

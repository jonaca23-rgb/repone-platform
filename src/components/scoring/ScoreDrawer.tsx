"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { enterResult } from "@/lib/actions/results";
import {
  joinClock,
  type LaneResult,
  type ResultStatus,
  type ScoringLane,
  type ScoringType,
  splitClock,
} from "@/lib/scoring/format";
import { fieldErrorsOf, useServerAction } from "@/lib/use-server-action";
import { FormAlert } from "@/components/app/FormAlert";
import { FormDialog } from "@/components/app/FormDialog";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const STATUSES: Array<{ value: ResultStatus; label: string }> = [
  { value: "completed", label: "Completed" },
  { value: "dnf", label: "DNF" },
  { value: "dns", label: "DNS" },
  { value: "dq", label: "DQ" },
];

const BIG_INPUT = "h-12 text-base";
const text = (n: number | null | undefined) => (n == null ? "" : String(n));

/**
 * One lane's score, in a drawer on a phone and a dialog on a desktop. The
 * only place a result is typed: the Score Keeper screen and the admin heat's
 * Results tab both open it. A changed form asks before it closes.
 */
export function ScoreDrawer({
  heatId,
  lane,
  existing,
  scoringType,
  subtitle,
  notice,
  onClose,
}: {
  heatId: string;
  lane: ScoringLane | null;
  existing: LaneResult | undefined;
  scoringType: ScoringType;
  subtitle: string;
  notice?: string;
  onClose: () => void;
}) {
  const [dirty, setDirty] = useState(false);
  const [askDiscard, setAskDiscard] = useState(false);

  const close = () => {
    setDirty(false);
    setAskDiscard(false);
    onClose();
  };
  const requestClose = () => (dirty ? setAskDiscard(true) : close());

  return (
    <FormDialog
      open={lane !== null}
      onOpenChange={(next) => {
        if (!next) requestClose();
      }}
      title={lane ? `Lane ${lane.laneNumber} · ${lane.name}` : ""}
      description={subtitle}
    >
      {() =>
        lane ? (
          <ScoreForm
            heatId={heatId}
            lane={lane}
            existing={existing}
            scoringType={scoringType}
            notice={notice}
            onDirty={() => setDirty(true)}
            onSaved={close}
            onCancel={requestClose}
            askDiscard={askDiscard}
            onKeepEditing={() => setAskDiscard(false)}
            onDiscard={close}
          />
        ) : null
      }
    </FormDialog>
  );
}

function ScoreForm({
  heatId,
  lane,
  existing,
  scoringType,
  notice,
  onDirty,
  onSaved,
  onCancel,
  askDiscard,
  onKeepEditing,
  onDiscard,
}: {
  heatId: string;
  lane: ScoringLane;
  existing: LaneResult | undefined;
  scoringType: ScoringType;
  notice?: string;
  onDirty: () => void;
  onSaved: () => void;
  onCancel: () => void;
  askDiscard: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
}) {
  // Every value lives in state, initialised once: a refresh while the drawer
  // is open (another scorekeeper saved) must not overwrite what's typed, and
  // hiding the score fields for DNF must not lose them.
  const [initial] = useState(() => ({ ...splitClock(existing?.time_seconds ?? null) }));
  const [status, setStatus] = useState<ResultStatus>(existing?.status ?? "completed");
  const [minutes, setMinutes] = useState(initial.minutes);
  const [seconds, setSeconds] = useState(initial.seconds);
  const [capped, setCapped] = useState(existing?.capped ?? false);
  const [reps, setReps] = useState(text(existing?.reps));
  const [load, setLoad] = useState(text(existing?.load));
  const [points, setPoints] = useState(text(existing?.points));
  const [tiebreak, setTiebreak] = useState(text(existing?.tiebreak_value));
  const [adjusted, setAdjusted] = useState(existing?.manually_adjusted ?? false);
  const [moreOpen] = useState(
    () => existing?.tiebreak_value != null || (existing?.manually_adjusted ?? false),
  );

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const save = useServerAction((fd: FormData) => enterResult(heatId, fd), {
    success: `Lane ${lane.laneNumber} saved`,
    toastErrors: false,
    // A save that lands after this lane was discarded (slow Wi-Fi) must not
    // close whichever lane is open by then.
    onSuccess: () => {
      if (mounted.current) onSaved();
    },
  });
  const errors = fieldErrorsOf(save.error);
  const edit =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      onDirty();
    };

  const numberField = (
    label: string,
    name: "reps" | "load" | "points",
    value: string,
    set: (v: string) => void,
    mode: "numeric" | "decimal",
  ) => (
    <div className="grid gap-2">
      <Label htmlFor={`score-${name}`}>{label}</Label>
      <Input
        id={`score-${name}`}
        name={name}
        type="text"
        inputMode={mode}
        autoComplete="off"
        value={value}
        onChange={(e) => edit(set)(e.target.value)}
        aria-invalid={errors?.[name] ? true : undefined}
        aria-describedby={errors?.[name] ? `score-${name}-error` : undefined}
        className={BIG_INPUT}
      />
      {errors?.[name] ? (
        <FieldError
          id={`score-${name}-error`}
          errors={errors[name].map((message) => ({ message }))}
        />
      ) : null}
    </div>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(new FormData(e.currentTarget));
      }}
      className="flex flex-col gap-5"
    >
      {notice ? (
        <p
          role="status"
          className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-text"
        >
          {notice}
        </p>
      ) : null}

      <input type="hidden" name="competitor_type" value="athlete" />
      <input type="hidden" name="competitor_id" value={lane.athleteId} />
      <input type="hidden" name="status" value={status} />

      <div className="grid gap-2">
        <span id="score-status-label" className="text-sm font-medium">
          Status
        </span>
        <ToggleGroup
          type="single"
          variant="outline"
          value={status}
          onValueChange={(v) => v && edit(setStatus)(v as ResultStatus)}
          aria-labelledby="score-status-label"
          className="w-full"
        >
          {STATUSES.map((s) => (
            <ToggleGroupItem
              key={s.value}
              value={s.value}
              className="min-h-11 flex-1 px-1 text-base data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              {s.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {status === "completed" && scoringType === "for_time" && (
        <>
          <fieldset
            className="grid gap-2"
            aria-describedby={errors?.time_seconds ? "score-time-error" : undefined}
          >
            <legend className="mb-2 text-sm font-medium">Time</legend>
            <input type="hidden" name="time_seconds" value={joinClock(minutes, seconds)} />
            <div className="flex items-end gap-2">
              <div className="grid flex-1 gap-1">
                <Label htmlFor="score-minutes" className="text-xs text-muted-foreground">
                  Minutes
                </Label>
                <Input
                  id="score-minutes"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  autoFocus
                  value={minutes}
                  onChange={(e) => edit(setMinutes)(e.target.value)}
                  aria-invalid={errors?.time_seconds ? true : undefined}
                  className="h-14 text-center font-display text-3xl tabular-nums"
                />
              </div>
              <span aria-hidden className="pb-3 font-display text-3xl">
                :
              </span>
              <div className="grid flex-1 gap-1">
                <Label htmlFor="score-seconds" className="text-xs text-muted-foreground">
                  Seconds
                </Label>
                <Input
                  id="score-seconds"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={seconds}
                  onChange={(e) => edit(setSeconds)(e.target.value)}
                  aria-invalid={errors?.time_seconds ? true : undefined}
                  className="h-14 text-center font-display text-3xl tabular-nums"
                />
              </div>
            </div>
            {errors?.time_seconds ? (
              <FieldError
                id="score-time-error"
                errors={errors.time_seconds.map((message) => ({ message }))}
              />
            ) : null}
          </fieldset>
          <Label htmlFor="score-capped" className="min-h-11 cursor-pointer gap-3 text-base">
            <Switch
              id="score-capped"
              name="capped"
              checked={capped}
              onCheckedChange={edit(setCapped)}
              aria-label="Time-capped"
            />
            Time-capped
          </Label>
          {capped && numberField("Reps", "reps", reps, setReps, "numeric")}
        </>
      )}
      {status === "completed" &&
        scoringType === "amrap" &&
        numberField("Total reps", "reps", reps, setReps, "numeric")}
      {status === "completed" &&
        scoringType === "max_load" &&
        numberField("Load", "load", load, setLoad, "decimal")}
      {status === "completed" &&
        (scoringType === "points" || scoringType === "other") &&
        numberField("Points", "points", points, setPoints, "decimal")}

      <details open={moreOpen} className="group rounded-lg border border-border">
        <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-medium">
          More
        </summary>
        <div className="flex flex-col gap-4 px-4 pb-4">
          <div className="grid gap-2">
            <Label htmlFor="score-tiebreak">Tie-break</Label>
            <Input
              id="score-tiebreak"
              name="tiebreak_value"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={tiebreak}
              onChange={(e) => edit(setTiebreak)(e.target.value)}
              className={BIG_INPUT}
            />
          </div>
          <Label htmlFor="score-adjust" className="min-h-11 cursor-pointer gap-3 text-base">
            <Switch
              id="score-adjust"
              name="manual_adjustment"
              checked={adjusted}
              onCheckedChange={edit(setAdjusted)}
              aria-label="Manual adjustment"
            />
            Manual adjustment
          </Label>
          <p className="text-sm text-muted-foreground">
            Turn this on when correcting a result after the fact, such as a resolved protest. The
            result is marked as adjusted.
          </p>
        </div>
      </details>

      <FormAlert error={save.error} />

      {askDiscard ? (
        <div
          role="alertdialog"
          aria-labelledby="score-discard-title"
          className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4"
        >
          <p id="score-discard-title" className="font-medium">
            Discard changes to lane {lane.laneNumber}?
          </p>
          <div className="flex gap-2">
            <Button
              autoFocus
              type="button"
              variant="outline"
              size="touch"
              className="flex-1"
              onClick={onKeepEditing}
            >
              Keep editing
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="touch"
              className="flex-1"
              onClick={onDiscard}
            >
              Discard
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="touch" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="touch" disabled={save.isPending} className="sm:min-w-40">
            {save.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {save.isPending ? "Saving…" : "Save lane"}
          </Button>
        </div>
      )}
    </form>
  );
}

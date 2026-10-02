import type { Metadata } from "next";
import { Dumbbell } from "lucide-react";
import { createClient } from "@/lib/db/server";
import { createWod, deleteWod, updateWod } from "@/lib/actions/wods";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { AdminBreadcrumb, eventCrumbs } from "@/components/shells/AdminBreadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getAdminEvent, requireAdminEvent } from "../adminEvent";

const SCORING_TYPES = [
  ["for_time", "For Time"],
  ["amrap", "AMRAP"],
  ["max_load", "Max Load"],
  ["points", "Points"],
  ["other", "Other"],
] as const;

const TIEBREAKS = [
  ["none", "None"],
  ["time", "Time"],
  ["reps", "Reps"],
  ["load", "Load"],
  ["points", "Points"],
] as const;

type Props = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await getAdminEvent((await params).eventId);
  return { title: event ? `WODs · ${event.name}` : "WODs" };
}

/** The fields shared by the Add and Edit forms; `idPrefix` keeps label ids unique per form. */
function WodFields({
  idPrefix,
  wod,
}: {
  idPrefix: string;
  wod?: {
    name: string;
    scoring_type: string;
    time_cap_seconds: number | null;
    tiebreak_type: string;
    description: string | null;
  };
}) {
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-name`}>Name</Label>
        <Input
          id={`${idPrefix}-name`}
          name="name"
          required
          defaultValue={wod?.name}
          placeholder="WOD 2"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-scoring`}>Scoring type</Label>
        <Select name="scoring_type" defaultValue={wod?.scoring_type ?? "for_time"}>
          <SelectTrigger id={`${idPrefix}-scoring`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCORING_TYPES.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-cap`}>Time cap (minutes)</Label>
        <Input
          id={`${idPrefix}-cap`}
          name="time_cap_minutes"
          type="number"
          min={0}
          defaultValue={wod?.time_cap_seconds ? wod.time_cap_seconds / 60 : ""}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-tiebreak`}>Tie-break</Label>
        <Select name="tiebreak_type" defaultValue={wod?.tiebreak_type ?? "none"}>
          <SelectTrigger id={`${idPrefix}-tiebreak`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIEBREAKS.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-full grid gap-2">
        <Label htmlFor={`${idPrefix}-description`}>Description / rules</Label>
        <Textarea
          id={`${idPrefix}-description`}
          name="description"
          rows={2}
          defaultValue={wod?.description ?? ""}
        />
      </div>
    </>
  );
}

export default async function WodsPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const [event, { data: wods }] = await Promise.all([
    requireAdminEvent(eventId),
    supabase
      .from("wods")
      .select("id, name, scoring_type, time_cap_seconds, tiebreak_type, description, rules")
      .eq("event_id", eventId)
      .order("sort_order"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="WODs"
        description="Workouts, scoring type, time caps and tie-breaks."
        breadcrumb={<AdminBreadcrumb items={eventCrumbs(event, { label: "WODs" })} />}
      />

      <Card>
        <CardContent>
          <form
            action={createWod.bind(null, eventId)}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <WodFields idPrefix="new-wod" />
            <Button type="submit" className="col-span-full w-fit">
              Add WOD
            </Button>
          </form>
        </CardContent>
      </Card>

      {wods?.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="No WODs yet"
          description="Add the first workout with the form above."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {(wods ?? []).map((w) => (
            <div key={w.id} className="rounded-lg border border-border bg-card px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{w.name}</p>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {w.scoring_type.replace("_", " ")}{" "}
                    {w.time_cap_seconds ? `· ${w.time_cap_seconds / 60} min cap` : ""}
                  </p>
                </div>
                <ConfirmAction
                  trigger="Remove"
                  title={`Remove ${w.name}?`}
                  description="The WOD is deleted with its heats, lanes and results. This cannot be undone."
                  confirmLabel="Remove WOD"
                  onConfirm={deleteWod.bind(null, eventId, w.id)}
                />
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer py-1 text-sm font-semibold text-brand-text">
                  Edit
                </summary>
                <form
                  action={updateWod.bind(null, eventId, w.id)}
                  className="mt-3 grid grid-cols-1 gap-3 rounded-lg border border-border bg-background p-4 sm:grid-cols-2 lg:grid-cols-4"
                >
                  <WodFields idPrefix={`wod-${w.id}`} wod={w} />
                  <input type="hidden" name="rules" defaultValue={w.rules ?? ""} />
                  <Button type="submit" className="col-span-full w-fit">
                    Save changes
                  </Button>
                </form>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

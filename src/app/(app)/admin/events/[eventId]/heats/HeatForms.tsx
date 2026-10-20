"use client";

import { createHeat, generateHeats } from "@/lib/actions/heats";
import { fieldErrorsOf, useServerAction } from "@/lib/use-server-action";
import { FormAlert } from "@/components/app/FormAlert";
import { FormField } from "@/components/app/FormField";
import { SubmitButton } from "@/components/app/SubmitButton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type Choice = { value: string; label: string };
export type HeatChoices = { floors: Choice[]; wods: Choice[]; divisions: Choice[] };
type FieldErrors = Record<string, string[]> | undefined;

/** A required pick from a short list, defaulting to the first option. */
function Pick({
  label,
  name,
  options,
  errors,
}: {
  label: string;
  name: string;
  options: Choice[];
  errors: FieldErrors;
}) {
  return (
    <FormField label={label} name={name} errors={errors?.[name]}>
      {({ name: fieldName, ...c }) => (
        <Select name={fieldName} required defaultValue={options[0]?.value}>
          <SelectTrigger {...c} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </FormField>
  );
}

/**
 * Slots every athlete or team registered in a division into lanes, across
 * as many heats as it takes. The lane count defaults to the last one used
 * for this event.
 */
export function GenerateHeatsForm({
  eventId,
  choices,
  lanesPerHeat,
  close,
}: {
  eventId: string;
  choices: HeatChoices;
  lanesPerHeat: number;
  close: () => void;
}) {
  const generate = useServerAction((fd: FormData) => generateHeats(eventId, fd), {
    success: "Heats generated",
    toastErrors: false,
    onSuccess: close,
  });
  const errors = fieldErrorsOf(generate.error);
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        generate.mutate(new FormData(e.currentTarget));
      }}
    >
      <Pick label="Floor" name="floor_id" options={choices.floors} errors={errors} />
      <Pick label="WOD" name="wod_id" options={choices.wods} errors={errors} />
      <Pick label="Division" name="division_id" options={choices.divisions} errors={errors} />
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Lanes per heat" name="lanes_per_heat" errors={errors?.lanes_per_heat}>
          {(c) => (
            <Input
              {...c}
              type="number"
              inputMode="numeric"
              min={1}
              max={20}
              required
              defaultValue={lanesPerHeat}
            />
          )}
        </FormField>
        <FormField label="First heat start" name="scheduled_start" errors={errors?.scheduled_start}>
          {(c) => <Input {...c} type="datetime-local" />}
        </FormField>
        <FormField
          label="Minutes between heats"
          name="interval_minutes"
          errors={errors?.interval_minutes}
        >
          {(c) => <Input {...c} type="number" inputMode="numeric" min={0} defaultValue={10} />}
        </FormField>
      </div>
      <FormAlert error={generate.error} />
      <SubmitButton pending={generate.isPending} pendingLabel="Generating…">
        Generate heats
      </SubmitButton>
    </form>
  );
}

/** One heat by hand, with empty lanes to fill on the heat's page. */
export function AddHeatForm({
  eventId,
  choices,
  close,
}: {
  eventId: string;
  choices: HeatChoices;
  close: () => void;
}) {
  const add = useServerAction((fd: FormData) => createHeat(eventId, fd), {
    success: "Heat added",
    toastErrors: false,
    onSuccess: close,
  });
  const errors = fieldErrorsOf(add.error);
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        add.mutate(new FormData(e.currentTarget));
      }}
    >
      <Pick label="Floor" name="floor_id" options={choices.floors} errors={errors} />
      <Pick label="WOD" name="wod_id" options={choices.wods} errors={errors} />
      <Pick label="Division" name="division_id" options={choices.divisions} errors={errors} />
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Heat #" name="heat_number" errors={errors?.heat_number}>
          {(c) => <Input {...c} type="number" inputMode="numeric" min={1} required />}
        </FormField>
        <FormField label="Of (total heats)" name="heat_count" errors={errors?.heat_count}>
          {(c) => <Input {...c} type="number" inputMode="numeric" min={1} />}
        </FormField>
        <FormField label="Lanes" name="lane_count" errors={errors?.lane_count}>
          {(c) => (
            <Input {...c} type="number" inputMode="numeric" min={1} max={20} defaultValue={6} />
          )}
        </FormField>
      </div>
      <FormField label="Scheduled start" name="scheduled_start" errors={errors?.scheduled_start}>
        {(c) => <Input {...c} type="datetime-local" />}
      </FormField>
      <FormAlert error={add.error} />
      <SubmitButton pending={add.isPending} pendingLabel="Adding…">
        Add heat
      </SubmitButton>
    </form>
  );
}

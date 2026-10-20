"use client";

import { createDisplay, updateDisplaySettings } from "@/lib/actions/displays";
import type { BlockSetting } from "@/lib/display/eligibility";
import { fieldErrorsOf, useServerAction } from "@/lib/use-server-action";
import { FormAlert } from "@/components/app/FormAlert";
import { FormField } from "@/components/app/FormField";
import { SubmitButton } from "@/components/app/SubmitButton";
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

const BLOCK_LABELS: Record<BlockSetting["type"], string> = {
  current_heat: "Current heat",
  next_heat: "Next heat",
  leaderboard: "Leaderboard",
};

/** Adds a display that follows one of the event's floors. */
export function AddDisplayForm({
  eventId,
  floors,
  close,
}: {
  eventId: string;
  floors: { id: string; name: string }[];
  close: () => void;
}) {
  const save = useServerAction((fd: FormData) => createDisplay(eventId, fd), {
    success: "Display added",
    toastErrors: false,
    onSuccess: close,
  });
  const errors = fieldErrorsOf(save.error);
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(new FormData(e.currentTarget));
      }}
    >
      <FormField label="Name" name="name" errors={errors?.name}>
        {(c) => <Input {...c} required placeholder="Entrance Display" />}
      </FormField>
      <FormField
        label="Floor"
        name="floor_id"
        errors={errors?.floor_id}
        description="The display shows this floor's heats."
      >
        {({ name, ...c }) => (
          <Select
            name={name}
            required
            defaultValue={floors.length === 1 ? floors[0].id : undefined}
          >
            <SelectTrigger {...c} className="w-full">
              <SelectValue placeholder="Choose a floor" />
            </SelectTrigger>
            <SelectContent>
              {floors.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>
      <FormAlert error={save.error} />
      <SubmitButton pending={save.isPending} pendingLabel="Adding…">
        Add display
      </SubmitButton>
    </form>
  );
}

export type DisplaySettings = {
  sponsorsEnabled: boolean;
  infoBlocksBetweenSponsors: number;
  blocks: BlockSetting[];
};

/** What a display rotates: sponsors, how many info blocks between them, and each block's time and weight. */
export function DisplaySettingsForm({
  eventId,
  displayId,
  settings,
  close,
}: {
  eventId: string;
  displayId: string;
  settings: DisplaySettings;
  close: () => void;
}) {
  const save = useServerAction((fd: FormData) => updateDisplaySettings(eventId, displayId, fd), {
    success: "Display saved",
    toastErrors: false,
    onSuccess: close,
  });
  const errors = fieldErrorsOf(save.error);
  return (
    <form
      className="grid gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(new FormData(e.currentTarget));
      }}
    >
      <div className="grid gap-4">
        <div className="flex min-h-11 items-center gap-3">
          <Switch
            id="display-sponsors"
            name="sponsors_enabled"
            defaultChecked={settings.sponsorsEnabled}
          />
          <Label htmlFor="display-sponsors">Show sponsors</Label>
        </div>
        <FormField
          label="Info blocks between sponsors"
          name="info_blocks_between_sponsors"
          errors={errors?.info_blocks_between_sponsors}
          description="1 to 5."
        >
          {(c) => (
            <Input
              {...c}
              type="number"
              inputMode="numeric"
              min={1}
              max={5}
              required
              defaultValue={settings.infoBlocksBetweenSponsors}
            />
          )}
        </FormField>
      </div>
      {settings.blocks.map((b) => (
        <fieldset key={b.type} className="grid gap-3">
          <legend className="sr-only">{BLOCK_LABELS[b.type]}</legend>
          <div className="flex min-h-11 items-center gap-3">
            <Switch id={`block-${b.type}`} name={`${b.type}_enabled`} defaultChecked={b.enabled} />
            <Label htmlFor={`block-${b.type}`} className="font-semibold">
              {BLOCK_LABELS[b.type]}
            </Label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Seconds"
              name={`${b.type}_duration`}
              errors={errors?.[`${b.type}_duration`]}
              description="5 to 60."
            >
              {(c) => (
                <Input
                  {...c}
                  type="number"
                  inputMode="numeric"
                  min={5}
                  max={60}
                  required
                  defaultValue={b.durationSeconds}
                />
              )}
            </FormField>
            <FormField
              label="Weight"
              name={`${b.type}_weight`}
              errors={errors?.[`${b.type}_weight`]}
              description="1 to 10."
            >
              {(c) => (
                <Input
                  {...c}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={10}
                  required
                  defaultValue={b.weight}
                />
              )}
            </FormField>
          </div>
        </fieldset>
      ))}
      <FormAlert error={save.error} />
      <SubmitButton pending={save.isPending} pendingLabel="Saving…">
        Save display
      </SubmitButton>
    </form>
  );
}

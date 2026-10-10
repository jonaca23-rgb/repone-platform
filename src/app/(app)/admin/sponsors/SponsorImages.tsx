"use client";

import {
  toggleCreativeActive,
  uploadSponsorCreative,
  uploadSponsorLogo,
} from "@/lib/actions/sponsors";
import { fieldErrorsOf, useServerAction } from "@/lib/use-server-action";
import { ActionSwitch } from "@/components/app/ActionSwitch";
import { FormAlert } from "@/components/app/FormAlert";
import { FormField } from "@/components/app/FormField";
import { SubmitButton } from "@/components/app/SubmitButton";
import { Input } from "@/components/ui/input";

const ACCEPT = "image/png,image/jpeg,image/webp";

/** Uploads or replaces a sponsor's logo (the broadcast sponsor card shows it). */
export function SponsorLogoForm({ sponsorId, close }: { sponsorId: string; close: () => void }) {
  const upload = useServerAction((fd: FormData) => uploadSponsorLogo(sponsorId, fd), {
    success: "Logo saved",
    toastErrors: false,
    onSuccess: close,
  });
  const errors = fieldErrorsOf(upload.error);
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        upload.mutate(new FormData(e.currentTarget));
      }}
    >
      <FormField
        label="Logo"
        name="logo"
        errors={errors?.logo}
        description="PNG with a transparent background works best. JPEG, PNG or WebP, under 4MB."
      >
        {(c) => <Input {...c} type="file" accept={ACCEPT} required />}
      </FormField>
      <FormAlert error={upload.error} />
      <SubmitButton pending={upload.isPending} pendingLabel="Uploading…">
        Save logo
      </SubmitButton>
    </form>
  );
}

export type Creative = { id: string; url: string; active: boolean };

/**
 * A sponsor's venue display creatives: each one with its switch, newest
 * first, and the upload for another.
 */
export function SponsorCreatives({
  sponsorId,
  sponsorName,
  creatives,
}: {
  sponsorId: string;
  sponsorName: string;
  creatives: Creative[];
}) {
  const upload = useServerAction((fd: FormData) => uploadSponsorCreative(sponsorId, fd), {
    success: "Creative added",
    toastErrors: false,
  });
  const errors = fieldErrorsOf(upload.error);

  return (
    <div className="grid gap-6">
      {creatives.length > 0 ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {creatives.map((c, i) => (
            <li key={c.id} className="grid gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.url}
                alt={`${sponsorName} creative ${creatives.length - i}`}
                className="aspect-[9/16] w-full rounded-md border border-border bg-muted object-cover"
              />
              <ActionSwitch
                checked={c.active}
                action={(next) => toggleCreativeActive(c.id, next)}
                label={`Show creative ${creatives.length - i}`}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No creatives yet.</p>
      )}
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          upload.mutate(new FormData(form), { onSuccess: () => form.reset() });
        }}
      >
        <FormField
          label="Add a creative"
          name="creative"
          errors={errors?.creative}
          description="Venue display creatives: 2160×3840 (9:16), JPEG or WebP, under 4MB."
        >
          {(c) => <Input {...c} type="file" accept={ACCEPT} required />}
        </FormField>
        <FormAlert error={upload.error} />
        <SubmitButton pending={upload.isPending} pendingLabel="Uploading…">
          Upload creative
        </SubmitButton>
      </form>
    </div>
  );
}

"use client";

import { uploadEventCoverPhoto } from "@/lib/actions/events";
import { fieldErrorsOf, useServerAction } from "@/lib/use-server-action";
import { FormAlert } from "@/components/app/FormAlert";
import { FormField } from "@/components/app/FormField";
import { SubmitButton } from "@/components/app/SubmitButton";
import { Input } from "@/components/ui/input";

/** Uploads or replaces an event's cover photo. */
export function CoverPhotoForm({ eventId, close }: { eventId: string; close: () => void }) {
  const upload = useServerAction((fd: FormData) => uploadEventCoverPhoto(eventId, fd), {
    success: "Cover photo saved",
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
        label="Photo"
        name="cover_photo"
        errors={errors?.cover_photo}
        description="JPEG, PNG, WebP, GIF or HEIC, under 8MB."
      >
        {(c) => <Input {...c} type="file" accept="image/*" required />}
      </FormField>
      <FormAlert error={upload.error} />
      <SubmitButton pending={upload.isPending} pendingLabel="Uploading…">
        Save photo
      </SubmitButton>
    </form>
  );
}

"use client";

import Link from "next/link";
import { ImageUp, MessageSquare, Pencil, QrCode } from "lucide-react";
import {
  removeAthletePhoto,
  updateAthleteProfile,
  uploadAthletePhoto,
} from "@/lib/actions/athletes";
import { fieldErrorsOf, useServerAction } from "@/lib/use-server-action";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { FormAlert } from "@/components/app/FormAlert";
import { FormDialog } from "@/components/app/FormDialog";
import { FormField } from "@/components/app/FormField";
import { SubmitButton } from "@/components/app/SubmitButton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AthleteForm, type AthleteValues } from "../AthleteForm";

function PhotoForm({ athleteId, close }: { athleteId: string; close: () => void }) {
  const upload = useServerAction((fd: FormData) => uploadAthletePhoto(athleteId, fd), {
    success: "Photo saved",
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
        name="photo"
        errors={errors?.photo}
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

/** Edit profile, photo, check-in QR and messaging: what you do to the athlete as a whole. */
export function AthleteHeaderActions({
  athleteId,
  firstName,
  name,
  values,
  hasPhoto,
  qrDataUrl,
  messageUserId,
}: {
  athleteId: string;
  firstName: string;
  name: string;
  values: AthleteValues;
  hasPhoto: boolean;
  qrDataUrl: string;
  messageUserId: string | null;
}) {
  return (
    <>
      <FormDialog
        title={`Edit ${name}`}
        trigger={
          <Button>
            <Pencil aria-hidden /> Edit profile
          </Button>
        }
      >
        {(close) => (
          <AthleteForm
            action={(fd) => updateAthleteProfile(athleteId, fd)}
            values={values}
            submitLabel="Save profile"
            pendingLabel="Saving…"
            success="Profile saved"
            close={close}
          />
        )}
      </FormDialog>
      <FormDialog
        title={hasPhoto ? "Change photo" : "Upload a photo"}
        trigger={
          <Button variant="outline">
            <ImageUp aria-hidden /> {hasPhoto ? "Change photo" : "Add photo"}
          </Button>
        }
      >
        {(close) => <PhotoForm athleteId={athleteId} close={close} />}
      </FormDialog>
      {hasPhoto ? (
        <ConfirmAction
          trigger="Remove photo"
          triggerVariant="ghost"
          title={`Remove ${name}'s photo?`}
          description="Their profile goes back to having no photo. You can upload a new one any time."
          confirmLabel="Remove photo"
          onConfirm={() => removeAthletePhoto(athleteId)}
        />
      ) : null}
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">
            <QrCode aria-hidden /> Check-in QR
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check-In QR code</DialogTitle>
            <DialogDescription>
              Scan this at event-day registration to pull up {firstName}&apos;s payment status.
            </DialogDescription>
          </DialogHeader>
          {/* eslint-disable-next-line @next/next/no-img-element -- server-generated data: URI PNG */}
          <img
            src={qrDataUrl}
            alt="Check-in QR code"
            className="mx-auto size-56 rounded-md border border-border"
          />
          <Button asChild variant="outline">
            <Link href={`/admin/checkin/${athleteId}`}>Open Check-In screen</Link>
          </Button>
        </DialogContent>
      </Dialog>
      {messageUserId ? (
        <Button asChild variant="outline">
          <Link href={`/admin/messages/${messageUserId}`}>
            <MessageSquare aria-hidden /> Message {firstName}
          </Link>
        </Button>
      ) : (
        <Button
          variant="outline"
          disabled
          title="Hasn't created a RepOne account yet, so can't be messaged."
        >
          <MessageSquare aria-hidden /> Message {firstName}
        </Button>
      )}
    </>
  );
}

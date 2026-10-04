"use client";

import type { PaymentStatus } from "@/lib/db/database.types";
import { markPaymentStatusForCheckin } from "@/lib/actions/payments";
import { useServerAction } from "@/lib/use-server-action";
import { ConfirmAction } from "@/components/app/ConfirmAction";
import { Button } from "@/components/ui/button";

/** The registration desk's three payment buttons for one registration. */
export function CheckinActions({
  athleteId,
  eventId,
  registrationId,
  athleteName,
  eventName,
}: {
  athleteId: string;
  eventId: string;
  registrationId: string;
  athleteName: string;
  eventName: string;
}) {
  const mark = useServerAction(
    (status: PaymentStatus) =>
      markPaymentStatusForCheckin(athleteId, eventId, registrationId, status),
    { success: (_d, status) => (status === "paid" ? "Marked paid" : "Waived") },
  );
  return (
    <>
      <Button
        variant="outline"
        size="touch"
        disabled={mark.isPending}
        onClick={() => mark.mutate("paid")}
      >
        Mark paid
      </Button>
      <Button
        variant="outline"
        size="touch"
        disabled={mark.isPending}
        onClick={() => mark.mutate("waived")}
      >
        Waive
      </Button>
      <ConfirmAction
        trigger="Reset to unpaid"
        triggerSize="touch"
        title={`Reset ${athleteName} to unpaid for ${eventName}?`}
        description="The payment goes back to unpaid and the desk shows Payment missing until it is marked paid or waived again."
        confirmLabel="Reset to unpaid"
        onConfirm={() => markPaymentStatusForCheckin(athleteId, eventId, registrationId, "unpaid")}
      />
    </>
  );
}

"use client";

import { updateRegistrationPayment } from "@/lib/actions/payments";
import { formatCents } from "@/lib/money";
import { fieldErrorsOf, useServerAction } from "@/lib/use-server-action";
import { NONE } from "@/lib/validation/none";
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
import { METHOD_OPTIONS, STATUS_OPTIONS } from "./paymentOptions";
import type { PaymentRow } from "./PaymentsTable";

/** One registration's payment: fee, amount override, status, method and a note. */
export function PaymentForm({
  eventId,
  row,
  fees,
  close,
}: {
  eventId: string;
  row: PaymentRow;
  fees: { id: string; name: string; amountCents: number }[];
  close: () => void;
}) {
  const save = useServerAction((fd: FormData) => updateRegistrationPayment(eventId, row.id, fd), {
    success: "Payment saved",
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
      <FormField label="Apply fee" name="fee_schedule_id" errors={errors?.fee_schedule_id}>
        {({ name, ...c }) => (
          <Select name={name} defaultValue={row.feeId ?? NONE}>
            <SelectTrigger {...c} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {fees.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name} ({formatCents(f.amountCents)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>
      <FormField
        label="Amount override"
        name="amount_dollars"
        errors={errors?.amount_dollars}
        description="Leave blank to use the fee's amount."
      >
        {(c) => (
          <Input
            {...c}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            placeholder={row.amountCents ? (row.amountCents / 100).toFixed(2) : "0.00"}
          />
        )}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Status" name="status" errors={errors?.status}>
          {({ name, ...c }) => (
            <Select name={name} defaultValue={row.status}>
              <SelectTrigger {...c} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
        <FormField label="Method" name="payment_method" errors={errors?.payment_method}>
          {({ name, ...c }) => (
            <Select name={name} defaultValue={row.method ?? "unpaid"}>
              <SelectTrigger {...c} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHOD_OPTIONS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
      </div>
      <FormField label="Notes" name="notes" errors={errors?.notes}>
        {(c) => (
          <Input {...c} defaultValue={row.notes ?? ""} placeholder="e.g. paid cash at check-in" />
        )}
      </FormField>
      <FormAlert error={save.error} />
      <SubmitButton pending={save.isPending} pendingLabel="Saving…">
        Save payment
      </SubmitButton>
    </form>
  );
}

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** A form's submit button: disabled with a spinner and a "…ing" label while saving. */
export function SubmitButton({
  pending,
  pendingLabel,
  disabled,
  children,
}: {
  pending: boolean;
  pendingLabel: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button type="submit" disabled={pending || disabled} className="max-sm:w-full">
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {pending ? pendingLabel : children}
    </Button>
  );
}

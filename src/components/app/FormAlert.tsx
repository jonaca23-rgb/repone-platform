import { fieldErrorsOf } from "@/lib/use-server-action";

/** A failure that belongs to no single field, shown above the form's buttons. */
export function FormAlert({ error }: { error: unknown }) {
  if (!(error instanceof Error)) return null;
  const fields = fieldErrorsOf(error);
  if (fields && Object.keys(fields).length > 0) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {error.message}
    </p>
  );
}

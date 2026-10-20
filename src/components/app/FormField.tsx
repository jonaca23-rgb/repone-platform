"use client";

import { useId } from "react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";

/** What a FormField hands its control. */
export type FormControlProps = {
  id: string;
  name: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
};

/**
 * A labelled control with its server-side errors under it. The control gets
 * id, name, aria-invalid and aria-describedby from here, so a screen reader
 * reads the error with the field.
 */
export function FormField({
  label,
  name,
  errors,
  description,
  children,
}: {
  label: string;
  name: string;
  errors?: string[];
  description?: string;
  children: (control: FormControlProps) => React.ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const descriptionId = `${id}-description`;
  const invalid = Boolean(errors?.length);
  const describedBy = [description ? descriptionId : null, invalid ? errorId : null]
    .filter(Boolean)
    .join(" ");
  const control: FormControlProps = { id, name };
  if (invalid) control["aria-invalid"] = true;
  if (describedBy) control["aria-describedby"] = describedBy;

  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children(control)}
      {description ? <FieldDescription id={descriptionId}>{description}</FieldDescription> : null}
      {invalid ? (
        <FieldError id={errorId} errors={errors?.map((message) => ({ message }))} />
      ) : null}
    </Field>
  );
}

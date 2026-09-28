/**
 * Turns the raw Postgres unique-violation error from writing to `athletes`
 * (see 0018_athlete_contact_info.sql's per-organization unique indexes on
 * email/phone) into a message an athlete or staff member can act on,
 * instead of a raw "duplicate key value violates unique constraint ..."
 * string. Used by every place that inserts or updates an athletes row:
 * admin's Add Athlete form, the self-service "Add New Athlete" flow, the
 * profile edit form, and athlete onboarding.
 */
export function friendlyAthleteWriteError(error: { message: string; code?: string }): string {
  const message = error.message ?? "";
  const isDuplicate = error.code === "23505" || message.includes("duplicate key value");

  if (isDuplicate) {
    if (message.includes("athletes_org_email_unique")) {
      return "An athlete with this email already exists in your organization.";
    }
    if (message.includes("athletes_org_phone_unique")) {
      return "An athlete with this phone number already exists in your organization.";
    }
    return "An athlete with this email or phone number already exists in your organization.";
  }

  return message || "Something went wrong saving this athlete.";
}

/** Trims a form field to null when blank, so empty strings never get stored
 * (and never accidentally satisfy a uniqueness check meant for real values). */
export function nullIfBlank(value: FormDataEntryValue | null): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Every athlete must have an email on file (0019_require_athlete_email.sql
 * makes this a NOT NULL + non-blank database constraint too) — this is the
 * shared app-layer check so every write path (admin add/edit, self-service
 * add, onboarding) fails fast with a clear message instead of a raw
 * constraint-violation error from Postgres.
 */
export function requireEmail(value: FormDataEntryValue | null): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) throw new Error("Email is required.");
  return trimmed;
}

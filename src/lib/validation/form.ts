import { z } from "zod";
import { parseClockToSeconds } from "../timer/compute";
import { NONE } from "./none";

// Server actions receive FormData straight from the browser, so every field
// is untrusted text. Each action declares a zod schema built from `field`
// and calls parseForm: blank optionals become null, numbers and checkboxes
// are coerced, enums are checked against the database's own values, and a
// bad value stops the action with a message a person can act on.

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function parseForm<S extends z.ZodType>(schema: S, formData: FormData): z.infer<S> {
  const raw: Record<string, FormDataEntryValue> = {};
  for (const [key, value] of formData.entries()) {
    if (!(key in raw)) raw[key] = value;
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ValidationError(result.error.issues[0]?.message ?? "Some of the input isn't valid.");
  }
  return result.data;
}

/**
 * For values a page binds into an action (`action.bind(null, id, …)`): they
 * travel through the browser too, so they get the same checks as form fields.
 */
export function parseArg<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ValidationError(result.error.issues[0]?.message ?? "Some of the input isn't valid.");
  }
  return result.data;
}

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

/** For fields a Select posts: its "none" item (NONE, see ./none) is blank too. Free text keeps it. */
const blankOrNoneToUndefined = (v: unknown) => (v === NONE ? undefined : blankToUndefined(v));

export const field = {
  /** Required text, trimmed. */
  text: (label: string, { max = 200 }: { max?: number } = {}) =>
    z
      .string({ error: `${label} is required.` })
      .trim()
      .min(1, `${label} is required.`)
      .max(max, `${label} is too long.`),

  /** Optional text, trimmed; blank or missing becomes null. */
  optionalText: ({ max = 2000, label = "Text" }: { max?: number; label?: string } = {}) =>
    z
      .preprocess(blankToUndefined, z.string().trim().max(max, `${label} is too long.`).optional())
      .transform((v) => v ?? null),

  /** An id from a select or hidden field. Any UUID shape (seed ids aren't RFC v4). */
  id: (label: string) => z.guid({ error: `${label} is missing or invalid.` }),

  /** Optional id from a select or hidden field; blank or the Select's NONE becomes null. */
  optionalId: (label: string) =>
    z
      .preprocess(blankOrNoneToUndefined, z.guid({ error: `${label} is invalid.` }).optional())
      .transform((v) => v ?? null),

  /** Required whole number within bounds. */
  int: (label: string, { min, max }: { min?: number; max?: number } = {}) => {
    let n = z.coerce
      .number({ error: `${label} must be a number.` })
      .int(`${label} must be a whole number.`);
    if (min !== undefined) n = n.min(min, `${label} must be at least ${min}.`);
    if (max !== undefined) n = n.max(max, `${label} must be at most ${max}.`);
    return z.preprocess(blankToUndefined, n);
  },

  /** Optional number (decimals allowed); blank becomes null. */
  optionalNumber: (label: string, { min, max }: { min?: number; max?: number } = {}) => {
    let n = z.coerce.number({ error: `${label} must be a number.` });
    if (min !== undefined) n = n.min(min, `${label} must be at least ${min}.`);
    if (max !== undefined) n = n.max(max, `${label} must be at most ${max}.`);
    return z.preprocess(blankToUndefined, n.optional()).transform((v) => v ?? null);
  },

  /** HTML checkbox: present ("on") is true, absent is false. */
  checkbox: () => z.preprocess((v) => v === "on" || v === "true", z.boolean()),

  /** Optional pick from a fixed set (a Select with a "none" item); blank or NONE becomes null. */
  optionalOneOf: <const T extends readonly [string, ...string[]]>(values: T, label: string) =>
    z
      .preprocess(
        blankOrNoneToUndefined,
        z.enum(values, { error: `Choose a valid ${label}.` }).optional(),
      )
      .transform((v) => v ?? null),

  /** Optional text chosen from a Select (not typed); blank or NONE becomes null. */
  optionalChoice: ({ max = 200, label = "Choice" }: { max?: number; label?: string } = {}) =>
    z
      .preprocess(
        blankOrNoneToUndefined,
        z.string().trim().max(max, `${label} is too long.`).optional(),
      )
      .transform((v) => v ?? null),

  /** One of a fixed set (pass the generated Constants.public.Enums.* list). */
  oneOf: <const T extends readonly [string, ...string[]]>(values: T, label: string) =>
    z.enum(values, { error: `Choose a valid ${label}.` }),

  /** Optional calendar date (YYYY-MM-DD from <input type="date">); blank becomes null. */
  optionalDate: (label: string) =>
    z
      .preprocess(
        blankToUndefined,
        z.iso.date({ error: `${label} must be a valid date.` }).optional(),
      )
      .transform((v) => v ?? null),

  /** A judge's clock entry: "3:45", "3:45.5" or plain seconds; blank becomes null. */
  clock: (label: string, example = "3:45") =>
    field.optionalText({ max: 20, label }).transform((v, ctx) => {
      if (v === null) return null;
      const seconds = parseClockToSeconds(v);
      if (seconds === null) {
        ctx.addIssue({
          code: "custom",
          message: `${label} must be a time like ${example}, or seconds.`,
        });
        return z.NEVER;
      }
      return seconds;
    }),

  /** Optional phone: digits and + ( ) . - spaces, optionally "ext 12" / "x12"; blank becomes null. */
  phone: () =>
    field
      .optionalText({ max: 40, label: "Phone" })
      .refine(
        (v) => v === null || /^\+?[0-9 ().-]{7,30}(\s*(ext\.?|x)\s*\d{1,6})?$/i.test(v),
        "Phone number isn't valid.",
      ),

  /** Required email, trimmed and lower-cased. */
  email: (label = "Email") =>
    z
      .string({ error: `${label} is required.` })
      .trim()
      .toLowerCase()
      .pipe(z.email({ error: `${label} isn't a valid email address.` })),
};

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
};
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * An uploaded photo (athlete or event cover). Only the image types the
 * storage buckets allow (0025_security_hardening.sql), under 8MB; the file
 * extension comes from the checked type, never from the uploaded filename.
 */
export function imageUpload(value: FormDataEntryValue | null): { file: File; ext: string } {
  if (!(value instanceof File) || value.size === 0) {
    throw new ValidationError("Choose an image file to upload.");
  }
  const ext = IMAGE_EXTENSIONS[value.type];
  if (!ext) throw new ValidationError("Please upload a JPEG, PNG, WebP, GIF or HEIC image.");
  if (value.size > MAX_IMAGE_BYTES) throw new ValidationError("Image must be under 8MB.");
  return { file: value, ext };
}

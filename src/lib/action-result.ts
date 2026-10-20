/**
 * What every server action returns. Expected failures ("an athlete with this
 * email already exists") are values, not throws: Next.js redacts thrown
 * messages in production, while a returned value crosses the network intact.
 * Unexpected errors still throw and reach the area's error screen.
 */
export type FieldErrors = Record<string, string[]>;

export type ActionFailure = { ok: false; message: string; fieldErrors?: FieldErrors };

export type ActionResult<T = undefined> =
  | ({ ok: true; message?: string } & (T extends undefined ? object : { data: T }))
  | ActionFailure;

/** Any ActionResult, whatever it carries on success. */
export type AnyActionResult = { ok: true; message?: string } | ActionFailure;

export function ok(): ActionResult;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(...args: [] | [T]) {
  return args.length === 0 ? { ok: true as const } : { ok: true as const, data: args[0] };
}

/** Success with words for the person, e.g. "Invitation sent." */
export function okMessage(message: string): ActionResult {
  return { ok: true, message };
}

export function fail(message: string, fieldErrors?: FieldErrors): ActionFailure {
  return fieldErrors ? { ok: false, message, fieldErrors } : { ok: false, message };
}

/** True for a resolved `{ ok: false }`: code that takes any promise treats it like a throw. */
export function isFailure(value: unknown): value is ActionFailure {
  return typeof value === "object" && value !== null && (value as { ok?: unknown }).ok === false;
}

/** Where a successful result says to go next (`ok({ href })`), if anywhere. */
export function hrefOf(value: unknown): string | undefined {
  const result = value as { ok?: unknown; data?: { href?: unknown } } | null | undefined;
  return result?.ok === true && typeof result.data?.href === "string"
    ? result.data.href
    : undefined;
}

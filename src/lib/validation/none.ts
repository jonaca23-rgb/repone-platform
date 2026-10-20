/**
 * The value a shadcn Select posts for its "none" item (Radix Select items
 * can't have an empty value). parseForm reads it back as a blank field, so
 * server actions see exactly what a native <option value=""> used to send.
 */
export const NONE = "__none";

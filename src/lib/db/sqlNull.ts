/**
 * Passes a nullable value to an RPC argument. `supabase gen types` types every
 * function argument as non-null, but PostgREST sends JSON null and our SQL
 * functions accept it (replace_standings' p_wod_id = overall, the optional
 * bootstrap_athlete profile fields). This is the one place that bridges it.
 */
export function sqlNull<T>(value: T | null): T {
  return value as T;
}

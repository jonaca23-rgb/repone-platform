// Fails fast with a clear message instead of a confusing Supabase client error
// if the project hasn't been configured yet.
//
// IMPORTANT: `value` must be passed in already resolved via a *literal*
// `process.env.NEXT_PUBLIC_...` access at each call site below, not looked up
// here by a dynamic `process.env[name]`. Next.js only inlines `NEXT_PUBLIC_`
// vars into the browser bundle when it can statically see the exact
// `process.env.NEXT_PUBLIC_X` expression in the source — a dynamic/computed
// lookup can't be inlined, so it silently evaluates to `undefined` in the
// browser (e.g. in client.ts's createClient(), used by the Production
// Dashboard and overlays) even though the same value reads fine server-side,
// where the full process.env is always available regardless of inlining.
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.local.example to .env.local and fill in your Supabase project's values.`
    );
  }
  return value;
}

export const supabaseUrl = () => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
export const supabaseAnonKey = () =>
  required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

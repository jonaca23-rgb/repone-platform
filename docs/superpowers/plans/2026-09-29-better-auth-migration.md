# BetterAuth Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Supabase Auth with BetterAuth, in the same shape as the sibling repo `~/Documents/GitHub/school-schedule`, without changing what any role can see or do.

**Architecture:**
- **Identity:** BetterAuth owns identity in `public."user" / session / account / verification / rate_limit`, through the drizzle adapter over a small `pg` pool.
- **Supabase access:** every Supabase call carries a short-lived ES256 JWT that the app mints from the BetterAuth session (`sub` = user uuid, `role` = authenticated). That keeps `auth.uid()` and every existing RLS policy working unchanged.
- **Foreign keys:** everything that referenced `auth.users(id)` now references `public."user"(id)`.
- **Browser client:** gets its token from `/api/supabase-token`.

**Tech Stack:** better-auth ^1.7.5, drizzle-orm ^0.45 (adapter only), pg ^8, jose ^6, server-only, Supabase CLI 2.95.4 with `signing_keys_path`, Next.js 16.3.

**Spec:** the decisions recorded 2026-09-29 (memory `project-stack-alignment`), plus the survey of school-schedule: `lib/auth/auth.ts`, `lib/supabase/sign-token.ts`, `lib/supabase/{server,client}.ts`, `app/api/supabase-token/route.ts`, `db/schema/auth.ts`, `scripts/rls-check.ts`.

**Branch:** `feat/better-auth`, from `fix/authorization-validation` (PR #7). The PR targets `staging` once #7 is merged.

## Global Constraints

- **User ids are uuid:** BetterAuth is configured with `advanced.database.generateId: "uuid"`, and every auth table id is `uuid`, because `auth.uid()` casts `sub` to uuid.
- **Required JWT claims:** `role: "authenticated"`, `aud: "authenticated"`, `sub: <user uuid>`, `email`. The algorithm is ES256 with the `kid` from `SUPABASE_JWT_SIGNING_KEY`, and the TTL is 300 s.
- **Sign-up:** athletes sign up themselves, so email/password sign-up stays enabled. Staff get roles only from `user_roles` or event assignments, never from signing up.
- **Passwords:** minimum 10 characters for new accounts. Dev accounts keep `Repone1234!`, which is 11 characters.
- **Google:** enabled only when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set. Locally it is off unless configured, and the athlete login hides the button.
- **Rate limiting:** `rateLimit: { storage: "database" }`, following BetterAuth's own default of production only.
- **Env names:** `DATABASE_URL`, `BETTER_AUTH_URL` (http://localhost:3200 locally), `BETTER_AUTH_SECRET`, `SUPABASE_JWT_SIGNING_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY` for scripts only.
- **Guards:** no RLS policy changes. The app-layer guards (`authorize.ts` / `guards.ts`) keep their names and signatures. Only `loadSessionContext` changes its input.
- **Migrations:** hand-written SQL in `supabase/migrations/`. The drizzle schema only mirrors the auth tables for the adapter; `drizzle-kit` is not used.
- **Checks:** every existing check (`pnpm check`, `db:rls-check`, `db:standings-check`, `db:timer-check`, `db:authz-check`) must pass at the end, signing in through BetterAuth.

## Review Focus

1. **A PostgREST token with a wrong claim fails silently as `anon`.** For example, a missing `role` returns empty reads instead of an error. The token check in Task 1 asserts that a minted token reads a row only `authenticated` can see, and that a token with `role` omitted cannot.
2. **An athlete who signs up must not gain any staff access.** Task 5's authz-check covers a brand-new BetterAuth account against org management and event access.
3. **Signing out must end Supabase access too.** A server client built after sign-out carries no token. Task 5's sign-out test reads a staff-only row before and after.
4. **The realtime messages badge (`useUnreadMessages`) runs as the user in the browser.** If the browser token fetch fails, it must degrade to no badge, not throw. Task 4 adds a test for the token route's 401 path, and Task 7 verifies the badge in the browser.
5. **Storage uploads (photos) authenticate with the minted token.** Local storage must accept ES256 tokens from the configured signing key. Task 7 uploads an athlete photo as admin, then checks that an athlete can't upload to another athlete's folder, using the existing `rls-check` storage checks, now signing in through BetterAuth.

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/signing-key.ts` (new, port) | Create `supabase/signing_keys.json` (ES256 JWK) if missing; `--print` prints it as one line for `.env.local` |
| `supabase/config.toml` (modify) | `signing_keys_path = "./signing_keys.json"` |
| `scripts/env-local.ts` (modify) | Also write `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_JWT_SIGNING_KEY`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET` |
| `supabase/migrations/0028_better_auth.sql` (new) | Auth tables; FKs repointed from `auth.users` to `public."user"`; profile trigger on `public."user"`; auth tables locked down |
| `src/db/schema/auth.ts`, `src/db/index.ts` (new) | Drizzle mirror of the auth tables and a pg pool (`max: 4`) for BetterAuth only |
| `src/lib/auth/auth.ts` (new) | `betterAuth({...})`, the single config shared by app and scripts |
| `src/lib/auth/server.ts` (new) | `import "server-only"` and re-export `auth` |
| `src/lib/auth/client.ts` (new) | `createAuthClient()` for the browser |
| `src/app/api/auth/[...all]/route.ts` (new) | `toNextJsHandler(auth)` |
| `src/lib/supabase/sign-token.ts` + `token.ts` (new) | `mintSupabaseToken({userId,email})`, `TOKEN_TTL_SECONDS` |
| `src/lib/db/server.ts` (rewrite) | `createClient()`: supabase-js with `accessToken` minted from the session |
| `src/lib/db/client.ts` (rewrite) | Browser client whose token comes from `/api/supabase-token` |
| `src/app/api/supabase-token/route.ts` (new) | 401 without a session; otherwise `{token, expiresIn}` with `no-store` |
| `src/lib/auth/authorize.ts` (modify) | `loadSessionContext(db, identity)` takes `{userId,email}` instead of calling `db.auth.getUser()` |
| `src/lib/auth/session.ts` (modify) | `getAuthSession()` (cached, from BetterAuth), then `getSessionContext` and `getAthleteSessionContext` built on it |
| `src/app/(app)/login/*`, `src/app/(app)/athlete/{login,signup,actions}` (modify) | Sign-in, sign-up and sign-out through `authClient` / `auth.api` |
| `src/app/auth/callback/route.ts`, `src/proxy.ts` (delete) | No Supabase OAuth code exchange and no session-refresh proxy |
| `scripts/auth-helpers.ts` (new) | `signInAs(email)` returns a Supabase client with a minted token; `createOrResetUser(...)` |
| `scripts/{dev-accounts,rls-check,authz-check,standings-check,timer-check,token-check}.ts` | Use BetterAuth and `auth-helpers` |
| `.claude/skills/verify-repone/scripts/doctor.sh`, README, AGENTS, `.github/workflows/ci.yml` | Accounts in `public."user"`, new env vars, `keys:ensure` in CI |

---

### Task 1: Signing keys, env, and a token PostgREST accepts

**Files:**
- Create: `scripts/signing-key.ts`, `src/lib/supabase/sign-token.ts`, `src/lib/supabase/token.ts`, `scripts/token-check.ts`
- Modify: `supabase/config.toml` (line with `# signing_keys_path`), `scripts/env-local.ts`, `.gitignore`, `package.json`

**Interfaces:**
- Produces: `mintSupabaseToken(identity: { userId: string; email: string | null }): Promise<string>`, `TOKEN_TTL_SECONDS = 300`; package scripts `keys:ensure`, `db:token-check`.

- [ ] **Step 1: Add the dependencies**

```bash
pnpm add better-auth@^1.7.5 drizzle-orm@^0.45.2 pg@^8.23.0 jose@^6.2.12 server-only@^0.0.1
pnpm add -D @types/pg
```

- [ ] **Step 2: Port the signing-key script** (the same content as school-schedule's `scripts/signing-key.ts`)

```ts
// scripts/signing-key.ts — makes supabase/signing_keys.json (gitignored) once; --print → one line for .env.local
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { exportJWK, generateKeyPair } from "jose";
const PATH = "supabase/signing_keys.json";
async function main() {
  if (!existsSync(PATH)) {
    const { privateKey } = await generateKeyPair("ES256", { extractable: true });
    const jwk = await exportJWK(privateKey);
    const key = { ...jwk, alg: "ES256", use: "sig", kid: randomUUID(), ext: true, key_ops: ["sign", "verify"] };
    writeFileSync(PATH, `${JSON.stringify([key], null, 2)}\n`);
    console.error(`Created ${PATH} (local only, never committed).`);
  }
  if (process.argv.includes("--print")) {
    process.stdout.write(JSON.stringify(JSON.parse(readFileSync(PATH, "utf8"))[0]));
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- Add `supabase/signing_keys.json` to `.gitignore`.
- In `supabase/config.toml`, replace `# signing_keys_path = "./signing_keys.json"` with `signing_keys_path = "./signing_keys.json"`.
- Add the `package.json` script `"keys:ensure": "tsx scripts/signing-key.ts"`.
- Prepend `pnpm keys:ensure && ` to `dev:setup`, and add `pnpm -s keys:ensure` before `supabase start` in `scripts/dev.sh`.

- [ ] **Step 3: Write `sign-token.ts`**, with the same comments as the sibling, reduced to RepOne's claims.

```ts
// src/lib/supabase/sign-token.ts — imported by scripts directly; app code uses token.ts (server-only)
import { type JWK, SignJWT, importJWK } from "jose";
export const TOKEN_TTL_SECONDS = 5 * 60;
let signingKey: Promise<{ key: CryptoKey; kid: string }> | null = null;
function getSigningKey() {
  signingKey ??= (async () => {
    const raw = process.env.SUPABASE_JWT_SIGNING_KEY;
    if (!raw) throw new Error("SUPABASE_JWT_SIGNING_KEY is not set. Run `pnpm env:local --force`.");
    const jwk = JSON.parse(raw) as JWK;
    if (!jwk.kid) throw new Error("SUPABASE_JWT_SIGNING_KEY has no kid.");
    const key = await importJWK({ ...jwk, key_ops: ["sign"] }, "ES256");
    return { key: key as CryptoKey, kid: jwk.kid };
  })();
  return signingKey;
}
/** `sub` must be public."user".id (auth.uid() casts it); `role` must be "authenticated" or PostgREST silently runs as anon. */
export async function mintSupabaseToken(identity: { userId: string; email: string | null }): Promise<string> {
  const { key, kid } = await getSigningKey();
  return new SignJWT({ role: "authenticated", email: identity.email })
    .setProtectedHeader({ alg: "ES256", typ: "JWT", kid })
    .setSubject(identity.userId).setAudience("authenticated")
    .setIssuedAt().setExpirationTime(`${TOKEN_TTL_SECONDS}s`).sign(key);
}
```

```ts
// src/lib/supabase/token.ts
import "server-only";
export { TOKEN_TTL_SECONDS, mintSupabaseToken } from "./sign-token";
```

- [ ] **Step 4: Update `scripts/env-local.ts`** to also write these (`--force` regenerates):

```ts
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${status.PUBLISHABLE_KEY}
SUPABASE_JWT_SIGNING_KEY='${execFileSync("pnpm", ["-s", "keys:ensure", "--print"], { encoding: "utf8" })}'
BETTER_AUTH_URL=http://localhost:3200
BETTER_AUTH_SECRET=${randomBytes(32).toString("base64")}
```

- Keep `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY` and `DATABASE_URL`.
- Keep writing `NEXT_PUBLIC_SUPABASE_ANON_KEY` until Task 4 removes its last reader.
- Also add `PUBLISHABLE_KEY` to the list of required keys.

- [ ] **Step 5: Write the failing token check** (`scripts/token-check.ts`, script `db:token-check`)

It proves three things against local PostgREST, using the service client for setup:
1. A token minted for the seed admin's `public."user"` id… This step can't pass until Task 2 creates `public."user"`, so in Task 1 it mints for a fake uuid instead.
2. The token is **accepted**: `select` on `profiles` returns 200 and an empty list, not a 401 "JWT invalid".
3. A token signed by a **different** key is rejected with 401.
4. A token with **no `role` claim** doesn't get `authenticated` access. Assert that `rpc("athlete_private_details")` errors with "permission denied" for anon, but not with the minted token.

```ts
const good = await mintSupabaseToken({ userId: crypto.randomUUID(), email: "x@example.test" });
const asUser = createClient(url, publishable, { accessToken: async () => good });
const r = await asUser.rpc("athlete_private_details", { p_athlete_ids: [] });
expect("minted token is accepted as authenticated", !r.error, r.error);
// forged: sign with a throwaway key → 401 PGRST301
```

- [ ] **Step 6:** Run `pnpm keys:ensure && pnpm db:stop && pnpm db:start && pnpm env:local --force && pnpm db:token-check`. Expected: all ok. Before the `config.toml` change it fails with "No suitable key" (PGRST301).
- [ ] **Step 7: Commit:** "Local Supabase verifies app-minted ES256 tokens".

### Task 2: Migration 0028 — BetterAuth tables, foreign keys, profile trigger

**Files:**
- Create: `supabase/migrations/0028_better_auth.sql`
- Test: `scripts/rls-check.ts`, which gains a section "auth tables are private".

**Interfaces:**
- Produces: the tables `public."user"(id uuid pk, name, email unique, email_verified, image, created_at, updated_at)`, `session`, `account`, `verification`, and `rate_limit`. Their columns match `src/db/schema/auth.ts` in Task 3 exactly. The snake_case column names come from `casing: "snake_case"`.

- [ ] **Step 1: Write the failing RLS assertions** in `rls-check.ts`, under a new section. For now they sign in as before; Task 6 switches them to BetterAuth.

```ts
console.log("\nAuth tables are private");
for (const table of ["user", "session", "account", "verification", "rate_limit"]) {
  const r = await anon.from(table as never).select("*").limit(1);
  expect(`anon cannot read ${table}`, !!r.error || (r.data?.length ?? 0) === 0, r.data);
}
```

- [ ] **Step 2: Write the migration.** Complete SQL:

```sql
-- 0028 — BetterAuth owns identity (replaces Supabase Auth). The app mints a Supabase JWT per request
-- (sub = public."user".id), so auth.uid() and every policy keep working. Tables mirror src/db/schema/auth.ts.
create table public."user" (
  id uuid primary key default gen_random_uuid(),
  name text not null, email text not null unique,
  email_verified boolean not null default false, image text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.session (
  id uuid primary key default gen_random_uuid(), expires_at timestamptz not null, token text not null unique,
  ip_address text, user_agent text, user_id uuid not null references public."user"(id) on delete cascade,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index session_user_id_idx on public.session (user_id);
create table public.account (
  id uuid primary key default gen_random_uuid(), account_id text not null, provider_id text not null,
  user_id uuid not null references public."user"(id) on delete cascade,
  access_token text, refresh_token text, id_token text,
  access_token_expires_at timestamptz, refresh_token_expires_at timestamptz, scope text, password text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index account_user_id_idx on public.account (user_id);
create table public.verification (
  id uuid primary key default gen_random_uuid(), identifier text not null, value text not null,
  expires_at timestamptz not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index verification_identifier_idx on public.verification (identifier);
create table public.rate_limit (id uuid primary key default gen_random_uuid(), key text not null unique,
  count integer not null, last_request bigint not null);

-- Nobody reaches these through the API; BetterAuth uses the owner connection.
alter table public."user" enable row level security;
alter table public.session enable row level security;
alter table public.account enable row level security;
alter table public.verification enable row level security;
alter table public.rate_limit enable row level security;
revoke all on public."user", public.session, public.account, public.verification, public.rate_limit from anon, authenticated;

-- Repoint every FK that referenced auth.users(id). The constraint names are Postgres defaults (<table>_<column>_fkey).
do $$ declare r record; begin
  for r in
    select c.conrelid::regclass as tbl, c.conname, a.attname as col, c.confdeltype
    from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confrelid = 'auth.users'::regclass and c.connamespace = 'public'::regnamespace
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format('alter table %s add constraint %I foreign key (%I) references public."user"(id) on delete %s',
      r.tbl, r.conname, r.col,
      case r.confdeltype when 'c' then 'cascade' when 'n' then 'set null' else 'no action' end);
  end loop;
end $$;

-- profiles: one per user, now created when BetterAuth inserts a user.
drop trigger if exists on_auth_user_created on auth.users;
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, full_name) values (new.id, new.name) on conflict (id) do nothing;
  return new;
end; $$ language plpgsql security definer set search_path = public;
create trigger on_user_created after insert on public."user" for each row execute function handle_new_user();
```

- [ ] **Step 3:** Run `pnpm db:reset`. Expected: `Applying migration 0028_better_auth.sql...` with no error. Then check that no foreign key still points at `auth.users`: `scripts/q.sh "select count(*) from pg_constraint where contype='f' and confrelid='auth.users'::regclass"` should return `0`.
- [ ] **Step 4:** Run `pnpm db:rls-check` for the new section only (`grep 'Auth tables'`). The dev accounts still live in `auth.users` until Tasks 3 and 6, so the other sections are expected to fail between Task 2 and Task 6; this branch is only merged after Task 6.
- [ ] **Step 5: Commit:** "Identity tables for BetterAuth; every user reference points at public.user".

### Task 3: BetterAuth server, route handler, browser client

**Files:**
- Create: `src/db/schema/auth.ts`, `src/db/schema/index.ts`, `src/db/index.ts`, `src/lib/auth/auth.ts`, `src/lib/auth/server.ts`, `src/lib/auth/client.ts`, `src/app/api/auth/[...all]/route.ts`, `scripts/auth-helpers.ts`
- Modify: `eslint.config.mjs` to ban `@/db` imports in `src/app/**`, `src/components/**` and `src/lib/actions/**` except `src/lib/auth/**`.

**Interfaces:**
- Produces:
  - `auth` (a BetterAuth instance). Scripts use `auth.api.signInEmail({ body, returnHeaders: true })`, `auth.api.signUpEmail({ body })`, `auth.api.getSession({ headers })` and `auth.api.signOut({ headers })`.
  - `authClient` in the browser: `authClient.signIn.email`, `authClient.signUp.email`, `authClient.signIn.social({ provider: "google", callbackURL })`, `authClient.signOut`.
  - `googleEnabled: boolean`.
  - `scripts/auth-helpers.ts`: `signInAs(email: string): Promise<{ db: SupabaseClient<Database>; userId: string; email: string }>`, which runs `signInEmail`, then `getSession`, then `mintSupabaseToken`, then a supabase-js client with `accessToken`. Later tasks use it.

- [ ] **Step 1:** Write `src/db/schema/auth.ts`. Its columns must match 0028 exactly, and it's written like school-schedule's `db/schema/auth.ts` lines 37–125 plus `rateLimit` at 288, **without** `role`, `banned`, `lastSignInAt`, `tourSeenAt`, `activeOrganizationId` or `impersonatedBy`. `src/db/index.ts` holds `new Pool({ connectionString: process.env.DATABASE_URL, max: 4 })` and `drizzle(pool, { schema, casing: "snake_case" })`.
- [ ] **Step 2: Write `auth.ts`**

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";
export const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema: {
    user: schema.user, session: schema.session, account: schema.account,
    verification: schema.verification, rateLimit: schema.rateLimit } }),
  advanced: { database: { generateId: "uuid" } }, // auth.uid() casts sub to uuid
  rateLimit: { storage: "database" },
  emailAndPassword: { enabled: true, minPasswordLength: 10, autoSignIn: true },
  socialProviders: googleEnabled ? { google: {
    clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! } } : {},
  account: { accountLinking: { enabled: true, trustedProviders: ["google"] } },
  plugins: [nextCookies()], // must stay last
});
```

- `server.ts`: `import "server-only"; export { auth, googleEnabled } from "./auth";`
- The route handler: `export const { GET, POST } = toNextJsHandler(auth);`
- `client.ts`: `export const authClient = createAuthClient();`

- [ ] **Step 3: Write the failing test:** `scripts/auth-check.ts` (script `db:auth-check`) checks that:
  - `signUpEmail` for `auth-check+<ts>@example.test` creates a `public."user"` row **and** a `profiles` row with the same id;
  - `signInEmail` with the wrong password throws `INVALID_EMAIL_OR_PASSWORD`;
  - a 9-character password is refused on sign-up;
  - `getSession` with the returned cookie gives the same `user.id`.

  At the end it deletes the test user through the service client, which cascades.
- [ ] **Step 3b (ruling R1): rewrite `scripts/dev-accounts.ts` on BetterAuth.** Add `createOrResetUser(email, name, password): Promise<string>` to `scripts/auth-helpers.ts`: look the user up in `public."user"` via the drizzle `db`; if present, set the credential `account.password` to `(await auth.$context).password.hash(password)`; else `auth.api.signUpEmail({ body: { email, password, name } })`. dev-accounts replaces its `auth.admin.*` calls with it; profile/role/assignment/athlete-link writes stay on the service client. Run `pnpm dev:accounts` twice (idempotent).

- [ ] **Step 4:** Implement until it passes, including `scripts/auth-helpers.ts` `signInAs` (the check's last assertion: `signInAs("admin@repone.test")` reads the admin's own `user_roles` row). Then run `pnpm db:auth-check` and `pnpm check`.
- [ ] **Step 5: Commit:** "BetterAuth serves sign-up, sign-in and sessions".

### Task 4: Supabase clients carry the minted token; sessions come from BetterAuth

**Files:**
- Rewrite: `src/lib/db/server.ts`, `src/lib/db/client.ts`
- Create: `src/app/api/supabase-token/route.ts`
- Modify: `src/lib/auth/authorize.ts` (`loadSessionContext`), `src/lib/auth/session.ts`, `src/lib/db/env.ts` (switch to the publishable key and remove the anon key), `scripts/authz-check.ts` (new `loadSessionContext` input)

**Interfaces:**
- Consumes: `auth`, `mintSupabaseToken`.
- Produces:
  - `getAuthSession(): Promise<{ userId: string; email: string; name: string } | null>`, cached with `react/cache`.
  - `loadSessionContext(db, identity: { userId: string; email: string | null } | null)`.
  - `createClient()`, which has the same name and return type as before, minus the `auth` namespace.

- [ ] **Step 1: Write the failing test.** In `authz-check.ts`, replace `loadSessionContext(db)` with `loadSessionContext(db, identity)`. Here `identity` comes from `auth.api.getSession` after `signInEmail` (see Task 6's `signInAs`). The script fails to compile until `authorize.ts` changes.
- [ ] **Step 2: Implement.**
  - `authorize.ts` takes the identity instead of calling `db.auth.getUser()`.
  - `session.ts`:

```ts
export const getAuthSession = cache(async () => {
  const s = await auth.api.getSession({ headers: await headers() });
  return s ? { userId: s.user.id, email: s.user.email, name: s.user.name } : null;
});
export const getSessionContext = cache(async () => {
  const id = await getAuthSession();
  return loadSessionContext(await createClient(), id);
});
```

  - `getAthleteSessionContext` uses `getAuthSession()` for `userId` and `email`.
  - `server.ts` follows the sibling's `createClient` (lines 27–38 of `school-schedule/lib/supabase/server.ts`) with `mintSupabaseToken({ userId, email })`.
  - `client.ts` follows the sibling's browser client with a single cached token (no per-school map).
  - The route returns 401 without a session, otherwise `{ token, expiresIn: TOKEN_TTL_SECONDS }` with `Cache-Control: no-store`.
- [ ] **Step 3: Test the 401 path.** Extend `db:auth-check`: `fetch("http://localhost:3200/api/supabase-token")` without a cookie returns 401. This needs the app running, so the script skips with a warning when the app isn't up.
- [ ] **Step 4:** Run `pnpm check`, `pnpm db:authz-check` and `pnpm db:auth-check`, and expect all to pass. Then `grep -rn "\.auth\." src`: only `authClient` and `auth.api` should remain.
- [ ] **Step 5: Commit:** "Every Supabase request carries a token minted from the BetterAuth session".

### Task 5: Sign-in, sign-up, sign-out and Google on BetterAuth

**Files:**
- Modify: `src/app/(app)/login/{page,actions}.tsx|ts`, `src/app/(app)/athlete/{actions.ts,login/AthleteLoginForm.tsx,signup/AthleteSignUpForm.tsx}`
- Delete: `src/app/auth/callback/route.ts`, `src/proxy.ts`
- Test: `scripts/authz-check.ts`

**Interfaces:**
- Consumes: `auth.api.signInEmail` (server actions keep the `useActionState` signatures), `authClient.signIn.social`, `googleEnabled`.

- [ ] **Step 1: Write the failing authz assertions** (Review Focus 2 and 3):
  - A brand-new sign-up (`signUpEmail`) has `orgManagerOf(ctx) === null` and `eventAccess(... [scorekeeper, producer, commentator]) === null`.
  - After `auth.api.signOut({ headers })`, `auth.api.getSession` returns null, and a client built from that null session can't read `user_roles` (0 rows).
- [ ] **Step 2: Implement the flows.**
  - Staff `signIn` and athlete sign-in call `auth.api.signInEmail({ body: { email, password }, headers: await headers() })` inside the server action (`nextCookies` sets the cookie), keep the same redirects, and map `APIError` to "Email or password is incorrect."
  - Athlete sign-up calls `auth.api.signUpEmail({ body: { email, password, name: email } })` and then redirects to `/athlete/onboarding`.
  - Sign-out calls `auth.api.signOut({ headers })`.
  - Google: the athlete login's button becomes a client call `authClient.signIn.social({ provider: "google", callbackURL: "/athlete" })`, rendered only when `googleEnabled`, which the page passes as a prop. BetterAuth's handler at `/api/auth/callback/google` replaces `/auth/callback`, so delete that file.
  - Delete `proxy.ts`: BetterAuth refreshes its session cookie on use (`updateAge`), and Supabase tokens are minted per request.
  - Add `safeNextPath` wherever a `next=` value is still read.
- [ ] **Step 3:** Run `pnpm db:authz-check` and `pnpm check`, and expect both to pass.
- [ ] **Step 4: Commit:** "Staff and athletes sign in, sign up and out through BetterAuth".

### Task 6: Scripts and CI sign in the way the app does

**Files:**
- Modify: `scripts/{rls-check,authz-check,standings-check,timer-check}.ts`, `.claude/skills/verify-repone/scripts/doctor.sh`, `.github/workflows/ci.yml`, `README.md`, `AGENTS.md`, `.env.example`

**Interfaces:**
- Produces: nothing new (createOrResetUser comes from Task 3).

- [ ] **Step 1:** (dev-accounts already moved to BetterAuth in Task 3, ruling R1.) Nothing to do here beyond confirming `pnpm dev:setup` recreates the accounts.
- [ ] **Step 2:** Replace every `client.auth.signInWithPassword(...)` in the check scripts with `signInAs(email)`. Anonymous clients use the publishable key with no token.
- [ ] **Step 3: `doctor.sh`.** The accounts check counts `public."user" where email like '%@repone.test'`. Add a check that `SUPABASE_JWT_SIGNING_KEY` and `BETTER_AUTH_SECRET` are set.
- [ ] **Step 4: CI.** In the `db` job, run `pnpm keys:ensure` before `supabase start`. After `env:local`, the step that writes the signing key is already covered by `env:local`. Add a `pnpm db:auth-check` step.
- [ ] **Step 5:** Run `pnpm dev:setup` from a stopped stack, then all checks: `pnpm check && pnpm db:rls-check && pnpm db:standings-check && pnpm db:timer-check && pnpm db:authz-check && pnpm db:auth-check`. All must pass.
- [ ] **Step 6: Commit:** "Scripts and CI sign in through BetterAuth like the app".

### Task 7: Prove it in the real app

**Files:** evidence only (`.verify/…`). Update `.claude/skills/verify-repone/features/access-control.md` and `athlete-portal.md` if any handle changed.

- [ ] **Step 1: `verify-repone`, access-control recipe.** Each role lands on its own page, the `/admin` gate works, and signed-out visitors are sent to `/login`.
- [ ] **Step 2: Athlete portal.**
  - Sign up `verify+<ts>@example.test`, go through onboarding, reach `/athlete`.
  - Message staff: the admin's unread badge appears through realtime (Review Focus 4).
  - Sign out: `/athlete` redirects to login.
- [ ] **Step 3: Admin.** Upload a cover photo and an athlete photo; both appear (Review Focus 5).
- [ ] **Step 4: Scoring recipe end to end,** which covers server actions and realtime as the scorekeeper.
- [ ] **Step 5:** Open the PR against `staging`, stacked on #7. The PR body lists the new env vars and the fact that `pnpm dev:setup` is required after pulling.

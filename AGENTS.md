<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Local development

`pnpm dev` brings up the whole stack (Podman → local Supabase → `.env.local` →
seeds → dev accounts → `next dev` on :3200). `pnpm dev:setup` is the clean
slate. Dev logins are all `*@repone.test` / `Repone1234!` (see README).
BetterAuth owns identity (`public."user"`, sessions in Postgres); Supabase Auth
is unused. The app mints a short-lived Supabase token from each session so RLS
still applies; scripts sign in the same way through `scripts/auth-helpers.ts`
(`signInAs`). `pnpm dev:setup` is required after pulling auth changes.
The project is not in production: there is no remote database to preserve, so
schema changes go in `supabase/migrations/` and are verified with
`pnpm db:reset && pnpm db:types`.

# Shipping a change

1. **Branch from an up-to-date `main`**, named with a type prefix and a short
   kebab-case description: `fix/…`, `feat/…`, `chore/…`, `docs/…`,
   `refactor/…`. Never commit directly to `main`.
2. **`pnpm check` passes** (lint, types, unit tests, Biome format) before every commit. Say
   so if it was skipped or failed; do not commit around it.
3. **Commit only what belongs to the change.** Stage files by name, not
   `git add -A`.
4. **Commit messages:** a plain sentence as the title saying what is now true
   (no `fix:`/`feat:` prefixes), then a body explaining why.
5. **Push and open a PR against `main`** with `gh pr create`, saying what
   changed, why, and how it was verified.
6. **Stop at the PR link.** The owner reviews and merges; agents do not merge.

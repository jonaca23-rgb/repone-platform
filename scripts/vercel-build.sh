#!/usr/bin/env bash
# Vercel's build (vercel.json `buildCommand`): production's migrations, then
# the app. The same release flow as the sibling repo tastebook.
#
# Merging to main is a release. Vercel's Git integration builds main, and
# this applies supabase/migrations to production before `next build`: the
# code that expects a column is never live before the column, and a failed
# migration fails the build, so nothing ships. No GitHub Actions minutes
# are spent on it.
#
# Only for production: any other build (there should be none — vercel.json
# lets Git deploy main alone) builds without touching a database. A build
# that cannot say which it is stops: shipping production code without its
# migrations is the one thing this must never do.
set -euo pipefail

case "${VERCEL_ENV:-}" in
  production | preview | development) ;;
  *)
    echo "VERCEL_ENV is '${VERCEL_ENV:-}': not knowing whether this is production, nothing is built." >&2
    exit 1
    ;;
esac

if [ "$VERCEL_ENV" = "production" ]; then
  # DATABASE_URL is the transaction pooler (port 6543), which migrations
  # cannot use; the same pooler on 5432 is its session mode, which they can,
  # and which Vercel's builders reach over IPv4 (the direct host is IPv6
  # only). Its query string, if any, is the app's, not the migrator's.
  url="${DATABASE_URL%%\?*}"
  url="${url/:6543\//:5432/}"

  # The CLI parses supabase/config.toml, which points at the gitignored
  # signing key; this writes a throwaway one for the parser alone. `db push`
  # sends migrations, never configuration, and never seed.sql.
  pnpm keys:ensure

  echo "Migrations that will be applied:"
  pnpm exec supabase db push --db-url "$url" --dry-run
  pnpm exec supabase db push --db-url "$url" --yes
fi

exec pnpm exec next build

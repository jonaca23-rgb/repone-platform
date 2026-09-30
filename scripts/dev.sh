#!/usr/bin/env bash
# `pnpm dev`: brings up the whole local stack, then Next.js.
#   Podman machine -> Supabase (migrations + seed on first start) -> .env.local
#   -> QA seed -> dev accounts -> next dev
# Every step is a no-op when already done, so this is safe to run every time.
# For a clean slate (wipe DB, re-apply migrations and seeds) use `pnpm dev:setup`.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v docker >/dev/null 2>&1 && command -v podman >/dev/null 2>&1; then
  if ! podman machine inspect podman-machine-default --format '{{.State}}' 2>/dev/null | grep -q running; then
    echo "Starting Podman machine..."
    podman machine start
  fi
fi

if ! ./scripts/supabase.sh status >/dev/null 2>&1; then
  # After a Podman VM restart the stack's containers still exist but are
  # stopped, and `supabase start` refuses ("already running"). `stop` removes
  # those containers and keeps the database volume, so no data is lost.
  ./scripts/supabase.sh stop >/dev/null 2>&1 || true
  echo "Starting local Supabase (first start applies migrations + seed.sql)..."
  ./scripts/supabase.sh start
fi

pnpm -s env:local
./scripts/seed-qa.sh
pnpm -s dev:accounts

echo "App: http://localhost:${PORT:-3200}   Studio: http://127.0.0.1:54523   Mailpit: http://127.0.0.1:54524"
# Port 3200 (not 3000) so this can run beside sibling projects; matches auth.site_url.
exec pnpm exec next dev --port "${PORT:-3200}" "$@"

#!/usr/bin/env bash
# Read-only: is this RepOne instance worth driving? Every FAIL prints its fix.
#   doctor.sh          exit 0 = drive it, exit 1 = fix the FAILs first
source "$(dirname "$0")/lib.sh"
FAILURES=0

echo "Checkout: $REPO_ROOT  branch $(git branch --show-current)  HEAD $(git rev-parse --short HEAD)"

# 1. Local Supabase
if "$(runtime)" ps --format '{{.Names}}' 2>/dev/null | grep -qx "$DB_CONTAINER"; then
  ok "Supabase db container running ($DB_CONTAINER)"
else
  fail "Supabase is not running — fix: pnpm db:start (or ./.claude/skills/verify-repone/scripts/app.sh start)"
fi

if [ "$(curl -s -o /dev/null -w '%{http_code}' "$API_URL/rest/v1/" -H "apikey: ${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-}")" = "200" ]; then
  ok "Supabase API answers at $API_URL"
else
  fail "Supabase API not answering at $API_URL — fix: pnpm db:start; if .env.local is stale: pnpm env:local --force"
fi

case "${NEXT_PUBLIC_SUPABASE_URL:-}" in
  "$API_URL") ok ".env.local targets the local stack" ;;
  *) fail ".env.local targets '${NEXT_PUBLIC_SUPABASE_URL:-<missing>}', not $API_URL — fix: pnpm env:local --force" ;;
esac

for var in SUPABASE_JWT_SIGNING_KEY BETTER_AUTH_SECRET; do
  if [ -n "${!var:-}" ]; then ok "$var is set"
  else fail "$var is not set — fix: pnpm env:local --force"; fi
done

# Podman VM memory: every local Supabase stack is ~10 containers. When the VM
# runs out, auth and PostgREST calls stall for 10-60s and pages time out.
if ! command -v docker >/dev/null 2>&1 && command -v podman >/dev/null 2>&1; then
  avail=$(podman machine ssh free -m 2>/dev/null | awk '/^Mem:/ {print $7}')
  stacks=$(podman ps --format '{{.Names}}' 2>/dev/null | sed -n 's/^supabase_db_//p' | tr '\n' ' ')
  if [ -n "$avail" ] && [ "$avail" -lt 500 ]; then
    warn "Podman VM has only ${avail}MB free (Supabase stacks running: ${stacks}) — expect slow pages; stop stacks you don't need (supabase stop in that project) or raise the VM memory"
  elif [ -n "$avail" ]; then
    ok "Podman VM memory: ${avail}MB free"
  fi
fi

# 2. Schema and data (only if the DB answers)
if [ "$FAILURES" -eq 0 ]; then
  files=$(ls supabase/migrations/*.sql | wc -l | tr -d ' ')
  applied=$(q "select count(*) from supabase_migrations.schema_migrations" 2>/dev/null || echo 0)
  if [ "$files" = "$applied" ]; then ok "All $files migrations applied"
  else fail "$applied of $files migrations applied — fix: pnpm db:reset && pnpm db:seed:qa && pnpm dev:accounts"; fi

  seed=$(q "select count(*) from events where id = '$EVENT_ID'" 2>/dev/null || echo 0)
  [ "$seed" = "1" ] && ok "Seed event present (Aprieta Entry Level)" || fail "Seed event missing — fix: pnpm db:reset"

  qa=$(q "select count(*) from circuits where name like 'QA Test Circuit%'" 2>/dev/null || echo 0)
  [ "$qa" != "0" ] && ok "QA circuit present" || warn "QA circuit not seeded (only circuit recipes need it) — fix: pnpm db:seed:qa"

  accounts=$(q "select count(*) from public.\"user\" where email like '%@repone.test'" 2>/dev/null || echo 0)
  [ "$accounts" -ge 6 ] && ok "$accounts dev accounts (*@repone.test / $PASSWORD)" || fail "Dev accounts missing ($accounts/6) — fix: pnpm dev:accounts"
fi

# 3. The Next.js server on :APP_PORT must be THIS checkout's
pid="$(app_listener_pid || true)"
if [ -z "$pid" ]; then
  fail "No app server on :$APP_PORT — fix: ./.claude/skills/verify-repone/scripts/app.sh start"
elif [ "$(pid_cwd "$pid")" != "$REPO_ROOT" ]; then
  fail ":$APP_PORT is served from $(pid_cwd "$pid"), not this checkout — do not drive it; stop it or use another port"
else
  code=$(curl -s -o /dev/null -w '%{http_code}' "$APP_URL/login")
  [ "$code" = "200" ] && ok "App answers at $APP_URL (pid $pid, this checkout)" || fail "$APP_URL/login returned $code — check .verify/run/dev.log"
fi

echo
if [ "$FAILURES" -eq 0 ]; then echo "Healthy — drive it."; else echo "$FAILURES problem(s) — fix before driving."; fi
exit $((FAILURES > 0))

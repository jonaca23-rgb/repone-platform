#!/usr/bin/env bash
# Shared by every verify-repone helper. Source it; don't run it.
#   source "$(dirname "$0")/lib.sh"
set -euo pipefail

REPO_ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
cd "$REPO_ROOT"

APP_PORT="${PORT:-3200}"
APP_URL="http://localhost:${APP_PORT}"
API_URL="http://127.0.0.1:54521"
STUDIO_URL="http://127.0.0.1:54523"
MAILPIT_URL="http://127.0.0.1:54524"
DB_CONTAINER="supabase_db_repone-platform"
RUN_DIR="$REPO_ROOT/.verify/run"          # this run's server bookkeeping (pid, log)
EVIDENCE_ROOT="$REPO_ROOT/.verify"        # proof folders live here and survive cleanup

# Seed fixtures (supabase/seed.sql) — stable ids every recipe can rely on.
ORG_ID="00000000-0000-0000-0000-000000000001"
EVENT_ID="00000000-0000-0000-0000-000000000010"   # "Aprieta Entry Level", status live
FLOOR_ID="00000000-0000-0000-0000-000000000030"   # "Floor A"
DIVISION_ID="00000000-0000-0000-0000-000000000040" # "Intermediate Female"
WOD_ID="00000000-0000-0000-0000-000000000050"     # "WOD 2", for_time
HEAT_ID="00000000-0000-0000-0000-000000000070"    # "Heat 6 / 9", lanes 1-6
PASSWORD="Repone1234!"

# Load .env.local (anon key etc.) without echoing it.
if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

runtime() { command -v docker || command -v podman; }

# q "<sql>" — one query against the LOCAL database, unaligned, no headers.
# Uses a local psql over DATABASE_URL when installed (fast); otherwise psql
# inside the db container (no install needed, but `podman exec` can stall for
# seconds when the Podman VM is busy).
q() {
  if command -v psql >/dev/null 2>&1 && [ -n "${DATABASE_URL:-}" ]; then
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atq -c "$1"
  else
    "$(runtime)" exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atq -c "$1"
  fi
}

# Prints the pid listening on APP_PORT, if any.
app_listener_pid() { lsof -tiTCP:"$APP_PORT" -sTCP:LISTEN 2>/dev/null | head -1; }

# Prints the working directory of a pid (to tell our checkout's server from another's).
pid_cwd() { lsof -a -p "$1" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p'; }

ok() { printf 'ok    %s\n' "$*"; }
warn() { printf 'warn  %s\n' "$*"; }
fail() { printf 'FAIL  %s\n' "$*"; FAILURES=$((${FAILURES:-0} + 1)); }

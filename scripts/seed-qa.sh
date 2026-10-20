#!/usr/bin/env bash
# Loads supabase/seed_qa_circuit.sql (3-stop circuit, 60 athletes, results)
# into the LOCAL database, once. It can't go through `supabase db reset`'s
# seeder: that prepares every statement up front, before the temp tables the
# script creates exist. Runs psql inside the db container, so no local psql
# is needed.
set -euo pipefail
cd "$(dirname "$0")/.."

container="supabase_db_repone-platform"
runtime="$(command -v docker || command -v podman)"
psql_in_db() { "$runtime" exec -i "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"; }

if [ "$(psql_in_db -Atc "select count(*) from circuits where name like 'QA Test Circuit%'")" != "0" ]; then
  echo "QA circuit already seeded."
  exit 0
fi

psql_in_db < supabase/seed_qa_circuit.sql
echo "Seeded QA circuit (supabase/seed_qa_circuit.sql)."

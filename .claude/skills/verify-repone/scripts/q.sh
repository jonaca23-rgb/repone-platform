#!/usr/bin/env bash
# One read query against the LOCAL database; prints rows as a|b|c.
#   ./.claude/skills/verify-repone/scripts/q.sh "select count(*) from results"
# Runs psql inside the Supabase db container, so no local psql is needed.
source "$(dirname "$0")/lib.sh"
q "${1:?usage: q.sh \"<sql>\"}"

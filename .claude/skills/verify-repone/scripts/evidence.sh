#!/usr/bin/env bash
# Creates this run's proof folder and prints its absolute path.
#   dir=$(./.claude/skills/verify-repone/scripts/evidence.sh scoring)
# Folders live in .verify/ (gitignored: screenshots show athlete names) and
# are never touched by app.sh stop or fixtures.sh.
source "$(dirname "$0")/lib.sh"
feature="${1:?usage: evidence.sh <feature-id>}"
dir="$EVIDENCE_ROOT/$(date +%Y%m%d-%H%M%S)-$feature"
mkdir -p "$dir"
{
  echo "feature: $feature"
  echo "branch:  $(git branch --show-current)"
  echo "commit:  $(git rev-parse --short HEAD)$(git diff --quiet || echo ' (+ uncommitted changes)')"
  echo "started: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
} > "$dir/run.txt"
echo "$dir"

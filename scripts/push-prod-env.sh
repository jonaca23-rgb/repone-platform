#!/usr/bin/env bash
# Adds the filled variables in .env.prod to Vercel's Production environment
# (project repone-platform, team cftservicespr). Run it yourself, from the repo:
#
#   scripts/push-prod-env.sh            # or: scripts/push-prod-env.sh other.env
#
# - Variables whose comment line says [secret] are added as Sensitive.
# - Empty values and placeholders (YOUR-…) are skipped.
# - A variable Vercel already has is left alone; to change one, edit it in the
#   dashboard (or `vercel env rm NAME production` and run this again).
# - Values go to the CLI on stdin: they are never printed or put in argv.
set -euo pipefail
cd "$(dirname "$0")/.."

FILE="${1:-.env.prod}"
[ -f "$FILE" ] || { echo "No $FILE here." >&2; exit 1; }
command -v vercel >/dev/null || { echo "Install the Vercel CLI: pnpm add -g vercel" >&2; exit 1; }

# Link this folder to the project once (writes .vercel/, which git ignores).
if [ ! -f .vercel/project.json ]; then
  vercel link --yes --project repone-platform --scope cftservicespr >/dev/null
fi

existing="$(vercel env ls production 2>/dev/null | awk 'NR>1 {print $1}')"

secret_next=false
added=0; skipped=0
while IFS= read -r line || [ -n "$line" ]; do
  if [[ "$line" =~ ^[[:space:]]*# ]]; then
    [[ "$line" == *"[secret]"* ]] && secret_next=true
    continue
  fi
  [[ "$line" =~ ^[[:space:]]*$ ]] && { secret_next=false; continue; }
  name="${line%%=*}"
  value="${line#*=}"
  sensitive=$secret_next
  secret_next=false

  if [ -z "$value" ] || [[ "$value" == *"YOUR-"* ]]; then
    echo "  skip  $name (empty)"; skipped=$((skipped + 1)); continue
  fi
  if grep -qx "$name" <<<"$existing"; then
    echo "  skip  $name (already in Vercel)"; skipped=$((skipped + 1)); continue
  fi
  if $sensitive; then
    printf '%s' "$value" | vercel env add "$name" production --sensitive >/dev/null
    echo "  added $name (sensitive)"
  else
    printf '%s' "$value" | vercel env add "$name" production >/dev/null
    echo "  added $name"
  fi
  added=$((added + 1))
done <"$FILE"

echo "Done: $added added, $skipped skipped. Check them at"
echo "https://vercel.com/cftservicespr/repone-platform/settings/environment-variables"

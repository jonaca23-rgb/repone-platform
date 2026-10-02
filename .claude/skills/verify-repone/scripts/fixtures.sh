#!/usr/bin/env bash
# Fixture ids, logins and URLs — and a reset for the scoring recipe.
#   fixtures.sh                 print logins, seed ids, URLs (no personal data)
#   fixtures.sh reset-scoring   clear results/standings for the seed heat so a scoring run starts clean
#   fixtures.sh reset-onboarding  unlink new-athlete@repone.test so the onboarding recipe can run again
source "$(dirname "$0")/lib.sh"

case "${1:-show}" in
  show)
    cat <<EOF
Logins (password for all: $PASSWORD) — everyone signs in at $APP_URL/login (then / is the start page)
  admin@repone.test          admin, org-wide            -> / (cards: all four staff modules)
  scorekeeper@repone.test    assigned to every event    -> / (Scorekeeper card)
  producer@repone.test       assigned to every event    -> / (Production card)
  commentator@repone.test    assigned to every event    -> / (Commentator card)
  athlete@repone.test        linked to Maria Rivera     -> /athlete
  new-athlete@repone.test    not onboarded yet          -> / (empty start page)

Seed ids (supabase/seed.sql)
  org       $ORG_ID  RepOneLive
  event     $EVENT_ID  Aprieta Entry Level (live)
  floor     $FLOOR_ID  Floor A
  division  $DIVISION_ID  Intermediate Female
  wod       $WOD_ID  WOD 2 (for_time, 15:00 cap)
  heat      $HEAT_ID  Heat 6/9, lanes 1-6:
            1 Maria Rivera  2 Sofia Delgado  3 Camila Ortiz  4 Valentina Cruz  5 Isabella Vega  6 Gabriela Torres

URLs
  scorekeeper floor   $APP_URL/scorekeeper/$FLOOR_ID
  production dash     $APP_URL/dashboard/$FLOOR_ID
  public leaderboard  $APP_URL/live/$EVENT_ID
  overlay index       $APP_URL/overlay/$FLOOR_ID
  Studio / Mailpit    $STUDIO_URL / $MAILPIT_URL
EOF
    ;;

  reset-scoring)
    q "delete from results where heat_id = '$HEAT_ID';
       delete from standings where division_id = '$DIVISION_ID';
       update heats set ended_at = null, started_at = null where id = '$HEAT_ID';"
    echo "Seed heat reset: no results, no standings for Intermediate Female, heat not finished."
    ;;

  reset-onboarding)
    q "delete from athletes where auth_user_id = (select id from auth.users where email = 'new-athlete@repone.test');"
    echo "new-athlete@repone.test is back to not onboarded."
    ;;

  *) echo "usage: fixtures.sh [show|reset-scoring|reset-onboarding]"; exit 2 ;;
esac

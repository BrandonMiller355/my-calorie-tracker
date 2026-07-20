#!/usr/bin/env bash
# cal-tracker access for OpenClaw. Signs in fresh each run (tokens last ~1h;
# runs are short, so no refresh-token handling). Endpoints and semantics:
# docs/openclaw-access.md in the cal-tracker repo.
#
# usage:
#   caltracker.sh consumed [YYYY-MM-DD|today|yesterday]     read a day's row
#   caltracker.sh set-burn <YYYY-MM-DD|today|yesterday> <kcal>  write a day's burn
#
# env: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, CALTRACKER_EMAIL,
#      CALTRACKER_PASSWORD  (see openclaw/SETUP.md)
# deps: curl, jq
set -euo pipefail

# The app stores local-calendar dates in this timezone; never use UTC.
TZ_NAME="America/New_York"

usage() {
  {
    echo "usage: caltracker.sh consumed [YYYY-MM-DD|today|yesterday]"
    echo "       caltracker.sh set-burn <YYYY-MM-DD|today|yesterday> <kcal>"
  } >&2
  exit 2
}

resolve_date() {
  case "$1" in
    today) TZ="$TZ_NAME" date +%F ;;
    yesterday)
      # GNU date first, then BSD/macOS date.
      TZ="$TZ_NAME" date -d yesterday +%F 2>/dev/null \
        || TZ="$TZ_NAME" date -v-1d +%F ;;
    *)
      [[ "$1" =~ ^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$ ]] \
        || { echo "not a valid YYYY-MM-DD date: $1" >&2; exit 2; }
      printf '%s\n' "$1" ;;
  esac
}

require_env() {
  local missing=0 v
  for v in SUPABASE_URL SUPABASE_PUBLISHABLE_KEY CALTRACKER_EMAIL CALTRACKER_PASSWORD; do
    if [[ -z "${!v:-}" ]]; then
      echo "missing env var: $v" >&2
      missing=1
    fi
  done
  ((missing == 0)) || exit 1
}

sign_in() {
  curl -fsS "$SUPABASE_URL/auth/v1/token?grant_type=password" \
    -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
    -H 'Content-Type: application/json' \
    -d "$(jq -n --arg e "$CALTRACKER_EMAIL" --arg p "$CALTRACKER_PASSWORD" \
          '{email: $e, password: $p}')" \
    | jq -er .access_token
}

# Prints the week_deficit_summary row for a single date. Uses $token.
day_summary() {
  curl -fsS "$SUPABASE_URL/rest/v1/rpc/week_deficit_summary" \
    -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
    -H "Authorization: Bearer $token" \
    -H 'Content-Type: application/json' \
    -d "$(jq -n --arg d "$1" '{p_from: $d, p_through: $d}')" \
    | jq -ec '.[0]'
}

cmd="${1:-}"
[[ -n "$cmd" ]] && shift

case "$cmd" in
  consumed)
    [[ $# -le 1 ]] || usage
    d=$(resolve_date "${1:-today}")
    require_env
    token=$(sign_in)
    day_summary "$d"
    ;;
  set-burn)
    [[ $# -eq 2 ]] || usage
    d=$(resolve_date "$1")
    [[ "$2" =~ ^[0-9]+(\.[0-9]+)?$ ]] || { echo "kcal must be a number, got: $2" >&2; exit 2; }
    require_env
    token=$(sign_in)
    curl -fsS "$SUPABASE_URL/rest/v1/rpc/set_day_burn" \
      -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
      -H "Authorization: Bearer $token" \
      -H 'Content-Type: application/json' \
      -d "$(jq -n --arg d "$d" --argjson c "$2" '{p_date: $d, p_calories: $c}')" \
      >/dev/null
    echo "burn for $d set to $2 kcal; day row now:"
    day_summary "$d"
    ;;
  *)
    usage
    ;;
esac

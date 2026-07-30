#!/usr/bin/env bash
# cal-tracker access for OpenClaw. Signs in fresh each run (tokens last ~1h;
# runs are short, so no refresh-token handling). Endpoints and semantics:
# docs/openclaw-access.md in the cal-tracker repo.
#
# usage:
#   caltracker.sh consumed [YYYY-MM-DD|today|yesterday]     read a day's row
#   caltracker.sh set-burn <YYYY-MM-DD|today|yesterday> <kcal>  write a day's burn
#   caltracker.sh find [query]                              read the food library
#   caltracker.sh log '<json>'                              insert a food entry
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
    echo "       caltracker.sh find [query]"
    echo "       caltracker.sh log '<json>'"
  } >&2
  exit 2
}

# A random UUID for the entry's primary key (the column has no default).
gen_uuid() {
  if [[ -r /proc/sys/kernel/random/uuid ]]; then
    cat /proc/sys/kernel/random/uuid
  elif command -v uuidgen >/dev/null 2>&1; then
    uuidgen | tr 'A-Z' 'a-z'
  else
    openssl rand -hex 16 \
      | sed -E 's/(.{8})(.{4})(.{4})(.{4})(.{12})/\1-\2-\3-\4-\5/'
  fi
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
  find)
    [[ $# -le 1 ]] || usage
    require_env
    token=$(sign_in)
    sel='id,name,description,serving_label,serving_size_amount,serving_size_unit,calories,carbs,protein,fat'
    url="$SUPABASE_URL/rest/v1/foods?archived_at=is.null&select=$sel&order=name"
    if [[ -n "${1:-}" ]]; then
      enc=$(printf '%s' "$1" | jq -sRr @uri)
      url="$url&name=ilike.*$enc*"
    fi
    curl -fsS "$url" \
      -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
      -H "Authorization: Bearer $token" \
      | jq -c '.'
    ;;
  log)
    [[ $# -eq 1 ]] || usage
    payload="$1"
    jq -e 'type == "object"' >/dev/null 2>&1 <<<"$payload" \
      || { echo "log needs a JSON object argument" >&2; exit 2; }
    # Required fields.
    meal=$(jq -er '.meal // empty' <<<"$payload") \
      || { echo "log: missing meal" >&2; exit 2; }
    case "$meal" in
      breakfast|lunch|dinner|snacks) ;;
      *) echo "meal must be breakfast|lunch|dinner|snacks, got: $meal" >&2; exit 2 ;;
    esac
    jq -e '.name | type == "string" and (. | length) > 0' >/dev/null 2>&1 <<<"$payload" \
      || { echo "log: missing name" >&2; exit 2; }
    for f in calories carbs protein fat; do
      jq -e --arg f "$f" '.[$f] | type == "number" and . >= 0' >/dev/null 2>&1 <<<"$payload" \
        || { echo "log: $f must be a number >= 0" >&2; exit 2; }
    done
    # serving_size_amount and serving_size_unit are all-or-nothing (a table check).
    jq -e '((.serving_size_amount == null) == (.serving_size_unit == null))' >/dev/null 2>&1 <<<"$payload" \
      || { echo "log: serving_size_amount and serving_size_unit must both be set or both omitted" >&2; exit 2; }
    d=$(resolve_date "$(jq -r '.date // "today"' <<<"$payload")")
    id=$(gen_uuid)
    # Build the row: log by serving count (amount=unit=serving_label), so
    # quantity == servings; source is 'manual' for a library match (food_id
    # present) or 'quick' for an estimate logged without touching the library.
    body=$(jq -c --arg id "$id" --arg date "$d" '
      {
        id: $id,
        date: $date,
        meal: .meal,
        name: .name,
        amount: (.servings // 1),
        unit: (.serving_label // "serving"),
        serving_label: (.serving_label // "serving"),
        quantity: (.servings // 1),
        calories: .calories, carbs: .carbs, protein: .protein, fat: .fat,
        source: (if .food_id then "manual" else "quick" end)
      }
      + (if .food_id then { food_id: .food_id } else {} end)
      + (if .description then { description: .description } else {} end)
      + (if .serving_size_amount then
          { serving_size_amount: .serving_size_amount, serving_size_unit: .serving_size_unit }
         else {} end)
    ' <<<"$payload")
    require_env
    token=$(sign_in)
    curl -fsS "$SUPABASE_URL/rest/v1/food_entries" \
      -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
      -H "Authorization: Bearer $token" \
      -H 'Content-Type: application/json' \
      -H 'Prefer: return=representation' \
      -d "$body" \
      | jq -ec '.[0]'
    ;;
  *)
    usage
    ;;
esac

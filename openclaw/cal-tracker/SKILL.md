---
name: cal-tracker
description: Read consumed calories and set a day's calorie-burn goal in Brandon's cal-tracker app (Supabase). Use when asked how many calories were eaten on a date, to check deficit numbers for a day, or to record/sync calories burned for a date — including the scheduled daily burn sync.
---

# cal-tracker

Talks to the cal-tracker Supabase project through `scripts/caltracker.sh`.
Requires env vars (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
`CALTRACKER_EMAIL`, `CALTRACKER_PASSWORD`) — see SETUP.md in the repo's
`openclaw/` folder if any are missing.

## Dates

All dates are **local-calendar `YYYY-MM-DD` in America/New_York**. The script
resolves the keywords `today` and `yesterday` in that timezone itself — prefer
the keywords over computing dates yourself.

## Read a day's calories

```
scripts/caltracker.sh consumed            # today
scripts/caltracker.sh consumed yesterday
scripts/caltracker.sh consumed 2026-07-15
```

Prints one JSON object:

```json
{"date":"2026-07-18","consumed_calories":2215,"effective_goal_calories":2740,"has_entries":true}
```

`consumed_calories` is what was eaten; `effective_goal_calories` is that day's
burn goal (after any override); the deficit for the day is
`effective_goal_calories - consumed_calories`. `has_entries` false means
nothing was logged that day.

## Set a day's calorie burn

```
scripts/caltracker.sh set-burn yesterday 2740
scripts/caltracker.sh set-burn 2026-07-15 2600
```

On success it prints a confirmation line plus the day's JSON row, whose
`effective_goal_calories` should equal the value just set.

Semantics (fixed server-side; don't try to work around them):

- **Calories is always overwritten** — the synced number is authoritative,
  even if a manual estimate was entered in the app that day.
- **Macro goals are never touched** by this call.

## Daily burn sync (cron job)

The scheduled job's task is: find Brandon's total calories burned yesterday
from your activity data, then run `set-burn yesterday <kcal>` and report the
confirmation row. If the burn number for yesterday is unavailable, say so and
write nothing — never guess or reuse another day's number.

## Errors

The script exits non-zero with a message on stderr. `missing env var` means
setup is incomplete (see SETUP.md). An auth failure (HTTP 400 on sign-in)
means bad credentials. Report failures verbatim; do not retry more than once.

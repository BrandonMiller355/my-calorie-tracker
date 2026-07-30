---
name: cal-tracker
description: Read consumed calories, log foods eaten, and set a day's calorie-burn goal in Brandon's cal-tracker app (Supabase). Use when asked how many calories were eaten on a date, to log/record a food or meal Brandon says he ate (e.g. "log an egg white omelet for breakfast"), to check deficit numbers for a day, or to record/sync calories burned — including the scheduled daily burn sync.
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

## Log a food Brandon ate

When Brandon says he ate something ("log an egg white omelet for breakfast",
"I had 2 slices of sara lee bread"), turn it into one entry per distinct food:

1. **Read his library first** with `find` and try to match each food to a saved
   one — by name or description, including brands and casual phrasing ("my usual
   protein shake"). Pass a query to narrow, or no argument to get the whole
   (non-archived) library:

   ```
   scripts/caltracker.sh find              # whole library
   scripts/caltracker.sh find omelet       # name contains "omelet"
   ```

   Each row has `id`, `name`, `description`, the serving anchor
   (`serving_label`, `serving_size_amount`, `serving_size_unit`), and per-serving
   `calories`/`carbs`/`protein`/`fat`.

2. **If a saved food plausibly matches**, log it against that food. Use the
   food's own nutrition and serving label — never re-estimate a matched food.
   Log by count of its serving label (`servings`), converting a stated weight to
   a serving count only when the food's serving size makes that exact; otherwise
   log 1 serving. Include `food_id` and snapshot the food's serving anchor:

   ```
   scripts/caltracker.sh log '{
     "meal": "breakfast", "date": "today",
     "food_id": "<id from find>", "name": "<food name>",
     "servings": 2, "serving_label": "slice",
     "serving_size_amount": 28, "serving_size_unit": "g",
     "calories": 70, "carbs": 13, "protein": 3, "fat": 1
   }'
   ```

3. **If nothing in the library matches**, estimate the nutrition yourself and
   log a *quick* entry — omit `food_id`. This does **not** create a library
   food (by design); the name and your estimate live on the entry alone. Keep
   the description as what Brandon said so it reads back sensibly:

   ```
   scripts/caltracker.sh log '{
     "meal": "breakfast", "date": "today",
     "name": "egg white omelet", "description": "egg white omelet",
     "calories": 220, "carbs": 4, "protein": 30, "fat": 9
   }'
   ```

`log` prints the inserted entry row. Report back what you logged and, for an
estimate, that the numbers are your estimate (state your least certain
assumption) so Brandon can correct it in the app.

Fields: `meal` (breakfast/lunch/dinner/snacks, required) and the four nutrition
numbers per serving are required; `date` defaults to today (keywords or
`YYYY-MM-DD`); `servings` defaults to 1. When Brandon doesn't name a meal, infer
it from the local time — breakfast before 10:30, lunch before 15:00, dinner
before 20:30, else snacks — or just ask.

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

## Why

The daily calorie field currently means "diet target to eat toward," but the user actually treats it as their Garmin-estimated calorie burn for that day, and wants a real weekly picture of surplus/deficit built from that — plus a configurable weekly deficit target to aim for. Today the app has no concept spanning more than one day, so there is no way to see how the week is trending without adding up days by hand.

## What Changes

- **BREAKING (semantic, not schema)**: the `calories` field in `Goals` is reinterpreted from "diet target" to "calorie burn ceiling" — a per-day estimate of total calories burned (typically entered from Garmin). UI labels change from "Calories" to "Calorie burn" everywhere a goal is displayed or edited (Settings, per-day goal editor, daily summary). Carbs/protein/fat are unchanged. No data migration needed: existing stored numbers keep working, only their meaning and label change, and the existing per-day override mechanism is what already lets this vary day to day.
- New "weekly deficit goal" setting (e.g. 3500 kcal/week), editable in Settings, stored as a single current value (no per-week history — changing it applies uniformly to how any week, past or present, is displayed).
- New weekly deficit widget on the day log screen, below the existing daily summary:
  - Week is a fixed calendar week, Monday–Sunday.
  - Value shown is `Σ(calorie burn − consumed)` from that week's Monday through whichever date is currently selected (inclusive) — not the full 7 days unless the selected date is a Sunday. Viewing today shows a live running total; navigating to a past date shows that week's total as of that date.
  - Compared against the weekly deficit goal.
  - Shows a disclaimer when any day in that Monday-through-selected-date range has zero logged entries (can't distinguish "forgot to log" from "ate nothing," so it flags rather than silently excluding or estimating).

## Capabilities

### New Capabilities

- `weekly-deficit`: Weekly deficit-to-date widget on the day log screen (calendar-week, Monday-anchored, computed through the selected date) and the configurable weekly deficit goal setting.

### Modified Capabilities

- `daily-summary`: The calorie goal requirement is relabeled and reinterpreted as a "calorie burn" ceiling rather than a diet target; the remaining/over-goal display language follows the same reinterpretation.
- `data-persistence`: Storage layer gains range-capable retrieval (entries totals + effective goals across a set of dates in one request) to support the weekly widget, and persistence for the new weekly deficit goal setting.

## Impact

- **Database**: new column on the `goals` table for the weekly deficit goal (single per-user value, default-goals row); new Postgres RPC (mirroring the existing `meal_suggestions` pattern) to aggregate a date range server-side rather than looping per-day client queries. No changes to `food_entries`, `foods`, or existing goal columns.
- **Storage layer**: `StorageRepository` interface and `SupabaseRepository` gain a week-range summary method and weekly-deficit-goal read/write.
- **UI**: `SettingsScreen`, `DayGoalEditor`, `goalFields.ts`, and `Summary` relabel "Calories" → "Calorie burn"; new widget component rendered on `DayLogScreen` below `Summary`.
- **Date helpers**: `src/lib/date.ts` gains a week-boundary helper (start-of-week for a given date key), since none exists today.
- No changes to food logging, food library, or search capabilities.

## Context

Today `goals` (default) and `daily_goals` (per-date override, PK `(user_id, date)`) each store a flat `{calories, carbs, protein, fat}` row, and `StorageRepository`/`SupabaseRepository` only ever read one date at a time (`getEntriesByDate(date)`, `getGoalsForDate(date)`). `date` is stored as `YYYY-MM-DD` text throughout (not a Postgres `date`), chosen so it sorts and compares lexicographically without timezone conversion — this still works for range queries. `src/lib/date.ts` has day-level helpers (`toDateKey`, `addDays`, `formatDateKey`) but no week-boundary concept. The existing `meal_suggestions` Postgres function (`supabase/schema.sql`) is the established pattern for server-side aggregation scoped by RLS (`security invoker`, `stable`).

## Goals / Non-Goals

**Goals:**
- Compute, for a selected date, the sum of `(effective calorie-burn goal − consumed calories)` for every date from that week's Monday through the selected date, in one request.
- Persist a single weekly deficit goal value per user, editable in Settings, with no per-week history.
- Relabel the calorie goal field as "Calorie burn" everywhere it's shown/edited, without migrating or reinterpreting any stored numbers.
- Flag when the computed range is missing log data for a day that has already elapsed.

**Non-Goals:**
- No rolling 7-day window — Monday-anchored calendar week only.
- No historical list/browse of past weeks; the widget is a pure function of the currently-selected date.
- No versioning of the weekly deficit goal (changing it retroactively re-colors past weeks the same way changing default goals already does).
- No change to macro (carbs/protein/fat) semantics, food logging, food library, or search.
- No automatic backfill/reinterpretation of previously-saved calorie values.

## Decisions

**1. Server-side range aggregation via a new RPC, not N per-day client calls.**
A new `stable`, `security invoker` function, e.g. `week_deficit_summary(p_from text, p_through text)`, returns one row per date in `[p_from, p_through]`: `date`, `consumed_calories`, `effective_goal_calories`, `has_entries`. It computes `effective_goal_calories` with a `daily_goals` lookup falling back to `goals` (same precedence `AppState` already applies client-side for a single day), and `consumed_calories`/`has_entries` from `food_entries`, generating the date series server-side (`generate_series` over the text dates, or a client-supplied list) so it's one round trip.
- *Alternative considered*: loop `getEntriesByDate` + `getGoalsForDate` seven times client-side. Rejected — up to 14 requests per widget render, and the override-vs-default precedence logic would need duplicating in the client for each day instead of living in one query.
- *Alternative considered*: pre-aggregate to a single scalar server-side. Rejected — returning per-day rows lets the client detect *which* days are missing entries (for the disclaimer) and reuse the existing `round1` rounding convention from `totals.ts`, matching how `meal_suggestions` already returns rows rather than a pre-reduced answer.

**2. Weekly deficit goal lives as a new nullable column on `goals`, not a new table.**
It's a single current value with the same shape as the rest of default goals (one row per user, no per-day variation), so it rides along on the existing `goals` row/upsert rather than introducing a table for one column.
- *Alternative considered*: a generic `settings` table. Rejected as unwarranted structure for one number.

**3. `weeklyDeficitGoal` is not added to the `Goals` type.**
`Goals` (`types.ts`) is the shape used for both default and per-day overrides, and is rendered via `GOAL_FIELDS` in the day-goal editor and settings form. The weekly deficit goal never varies per day, so folding it into `Goals` would make it show up in `DayGoalEditor`'s per-day override form, which is wrong. It's modeled as its own field (`weeklyDeficitGoal: number | null`) alongside `defaultGoals` in `AppState`, with its own save method, mirroring how `goalsAreDefault` already sits next to `defaultGoals` without being part of `Goals`.

**4. Week boundary: `startOfWeek(dateKey): string` added to `date.ts`.**
Computes the Monday on/before the given date using the same noon-anchored `Date` construction `addDays` already uses, so it inherits the existing DST-safe behavior rather than introducing a second convention.

**5. Missing-entries disclaimer excludes the selected date only when the selected date is today.**
A day counts as "missing" if it has zero entries and it has actually elapsed. For any past selected date, that includes the selected date itself (a fully-elapsed day with nothing logged is a real gap). For today, today is still in progress, so its own emptiness (e.g., checking the widget before breakfast) shouldn't trigger the disclaimer — only prior days in the range can. Rule: flag date `d` when `d` has zero entries and (`d < selectedDate` or `selectedDate !== todayKey()`).
- *Alternative considered*: always flag the selected date too. Rejected — the disclaimer would show constantly on the current day for reasons unrelated to actual missing history.

**6. Relabeling is presentation-only.**
`GOAL_FIELDS`'s label for `calories` changes to "Calorie burn (kcal)"; `Summary`'s per-metric label and the settings/day-editor copy follow. No renaming of the `calories` field itself in `types.ts`/DB — only display strings change, keeping the diff small and avoiding a column rename migration.

## Risks / Trade-offs

- **New SQL function to maintain** → mitigated by mirroring the already-proven `meal_suggestions` shape (`security invoker`, `stable`, RLS-scoped).
- **Existing stored `calories` values keep whatever meaning they had (diet target) until the user re-enters them as a burn estimate** → this is the explicit intent of the change; no automatic reinterpretation is possible, and the widget will simply be misleading until the user starts entering real burn numbers. No mitigation beyond the relabeled UI making the expected input clearer going forward.
- **A week viewed early (e.g., Monday) will always show a small deficit relative to the weekly goal** → acceptable per the point-in-time design the user asked for; not a bug.
- **`daily_goals`/`goals` fallback logic now exists in two places (client `AppState` reducer for single-day, new SQL function for ranges)** → mitigation: keep the precedence rule (`daily_goals` row wins, else `goals`) identical and simple enough (`COALESCE`) that drift is unlikely; call out in code review if the single-day path ever changes.

## Migration Plan

- Additive-only schema change: new nullable `weekly_deficit_goal` column on `goals`, new RPC function. Apply via `supabase/schema.sql` per the existing manual-apply workflow (no rows need backfilling; `null` means "not set").
- No rollback complexity beyond dropping the column/function; no existing behavior depends on them.
- Ship UI relabeling and the new widget together; there's no meaningful way to deploy one without user-facing confusion from the other (a "Calorie burn" label with no weekly widget, or a weekly widget still saying "Calories," would both misdescribe the feature).

## Open Questions

None outstanding. (Resolved: when `weeklyDeficitGoal` is `null`, the widget shows the running deficit number always and omits only the comparison-to-goal line — consistent with how `goalsAreDefault` already degrades gracefully elsewhere.)

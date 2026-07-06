## 1. Database

- [x] 1.1 Add nullable `weekly_deficit_goal numeric` column to the `goals` table in `supabase/schema.sql`
- [x] 1.2 Add `week_deficit_summary(p_dates text[])` (or equivalent date-range signature) SQL function: `security invoker`, `stable`, RLS-scoped, returning `date, consumed_calories, effective_goal_calories, has_entries` per requested date, applying `daily_goals` override falling back to `goals`
- [x] 1.3 Apply the schema changes via the Supabase SQL editor per the existing manual-apply workflow

## 2. Date helpers

- [x] 2.1 Add `startOfWeek(dateKey: string): string` to `src/lib/date.ts` (Monday on/before the given date, same noon-anchored `Date` construction as `addDays`)
- [x] 2.2 Unit tests for `startOfWeek` covering a Monday, a Sunday, and a mid-week date, plus a case crossing a month/year boundary

## 3. Storage layer

- [x] 3.1 Add `getWeekDeficitSummary(dates: string[])` (or `(from, through)`) to `StorageRepository` interface
- [x] 3.2 Implement it in `SupabaseRepository` via the new RPC
- [x] 3.3 Add `getWeeklyDeficitGoal(): Promise<number | null>` and `saveWeeklyDeficitGoal(goal: number): Promise<void>` to `StorageRepository` and `SupabaseRepository`, reading/writing the new `goals.weekly_deficit_goal` column

## 4. App state

- [x] 4.1 Add `weeklyDeficitGoal: number | null` to `AppState`/`AppContextValue`, loaded alongside `defaultGoals`, with a `saveWeeklyDeficitGoal` action (mirrors the existing `defaultGoals`/`saveDefaultGoals` pattern, not part of the `Goals` type)
- [x] 4.2 Add week-summary loading keyed on the selected `date`: derive `startOfWeek(date)`, fetch `getWeekDeficitSummary` for that range, store per-day results in state, re-fetch when `date` changes (mirrors the existing per-date `entries`/`day-goal` `useEffect` pattern)
- [x] 4.3 Derive from the loaded week data: total deficit-to-date (sum of `effective_goal_calories - consumed_calories` for dates `<= selected date`), and the missing-entries flag per the rule in design.md (flag elapsed zero-entry days; exclude today's own emptiness when the selected date is today)

## 5. UI relabeling

- [x] 5.1 Update `GOAL_FIELDS` label for `calories` in `src/lib/goalFields.ts` to "Calorie burn (kcal)"
- [x] 5.2 Update copy in `SettingsScreen.tsx`, `DayGoalEditor.tsx`, and `Summary.tsx` referencing "Calories"/"calorie goal" to "Calorie burn"

## 6. Weekly deficit widget

- [x] 6.1 Build a `WeeklyDeficit` component: shows deficit-to-date, comparison against `weeklyDeficitGoal` when set (omit the comparison line, not the whole widget, when unset), and the missing-entries disclaimer when applicable
- [x] 6.2 Render it on `DayLogScreen` below the existing `Summary`
- [x] 6.3 Add a weekly deficit goal input to `SettingsScreen` (optional field; blank means unset)

## 7. Tests

- [x] 7.1 Unit tests for the deficit-to-date and missing-entries-disclaimer derivation logic (today-in-progress exclusion, past-day inclusion, Monday-only case)
- [x] 7.2 Component/screen tests for `WeeklyDeficit` (goal set / unset / disclaimer shown) and for the relabeled `Summary`/`SettingsScreen`/`DayGoalEditor` copy
- [x] 7.3 `SupabaseRepository` tests for `getWeekDeficitSummary` and the weekly-deficit-goal read/write methods

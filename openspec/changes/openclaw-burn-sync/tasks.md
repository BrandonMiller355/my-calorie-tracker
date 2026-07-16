## 1. App-side fallback (ship first — behavior-neutral while all rows have concrete macros)

- [ ] 1.1 Widen the day-override shape: `getGoalsForDate` in `StorageRepository`/`SupabaseRepository` returns macros as possibly null (calories always present); update the interface doc comments
- [ ] 1.2 Change the effective-goals derivation in `AppState` from whole-object `dayGoalOverride ?? defaultGoals` to a per-field merge (override field if non-null, else default); keep `dayGoalIsOverridden` keyed on row presence
- [ ] 1.3 Update tests: repository tests for the nullable shape, app-level test covering a calories-only override (effective macros = defaults, effective calories = override)

## 2. Database migration and function

- [ ] 2.1 Append to `supabase/schema.sql`: `alter table daily_goals` dropping NOT NULL on `carbs`, `protein`, `fat` (null = no macro override, falls back to defaults at read time)
- [ ] 2.2 Append `set_day_burn(p_date text, p_calories numeric)`: security invoker, `insert into daily_goals (date, calories) values (p_date, p_calories) on conflict (user_id, date) do update set calories = excluded.calories`; comment the calories-only overwrite semantics
- [ ] 2.3 Apply both via the Supabase dashboard SQL editor (after the app change from group 1 is deployed)

## 3. Verification against the live project

- [ ] 3.1 Insert case: call `rpc/set_day_burn` (authenticated) for a date with no `daily_goals` row; confirm the created row has the passed calories and null macros, and the app shows default macro goals with the overridden calories for that date
- [ ] 3.2 Conflict case: set custom macros for that date in the app, call `set_day_burn` again with a different calorie value; confirm calories changed and macros are untouched
- [ ] 3.3 Read case: call `rpc/week_deficit_summary` with `p_from = p_through` for a logged date and confirm `consumed_calories` matches the app's daily total
- [ ] 3.4 Confirm the weekly deficit widget in the app reflects the synced burn value for the test date, then clean up test rows

## 4. OpenClaw access documentation

- [ ] 4.1 Write a short access-pattern doc (e.g. `docs/openclaw-access.md`): auth token endpoint + publishable key sign-in, refresh-token flow, the two RPC calls with example request/response bodies, the local-timezone `YYYY-MM-DD` date convention, and the always-overwrite-calories / never-touch-macros semantics

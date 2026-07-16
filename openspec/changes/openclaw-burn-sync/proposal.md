## Why

The weekly deficit is only accurate when each day's calorie-burn goal reflects what was actually burned, which today requires manually editing the custom goal in the app every day. The user's OpenClaw machine already knows the burn number and can also make use of consumed-calorie data, so giving it direct, authenticated access to the database removes that daily manual step.

## What Changes

- Make the `daily_goals` macro columns (`carbs`, `protein`, `fat`) nullable: null means "no macro override — fall back to the default `goals` row at read time." A day override can now be calories-only.
- Add a `set_day_burn(p_date, p_calories)` Postgres function (security invoker, RLS-scoped) that upserts a calories-only `daily_goals` row for the given date: on insert, macros are left null; on conflict it updates only `calories`, never touching existing macro values.
- Add per-field fallback in the app where the day override is applied: override macros are used when present, defaults otherwise. The day-goal editor continues to save all four values (a user edit makes macros concrete).
- Establish and document the external access pattern for OpenClaw: it authenticates as the (single) app user via email + password against Supabase Auth using the publishable key, then calls the standard PostgREST `rpc/` endpoints with the resulting JWT. No edge functions, no service-role key, no new security boundary — RLS remains the sole boundary.
- Reads reuse the existing `week_deficit_summary` RPC with `p_from = p_through = <date>` to get consumed calories for a single day; no new read surface is added.

## Capabilities

### New Capabilities

- `external-burn-sync`: Authenticated external (non-app) access for reading a day's consumed calories and writing a day's calorie-burn goal, so an automated client can keep the weekly deficit accurate without manual input.

### Modified Capabilities

- `data-persistence`: per-day goal override rows may now carry calories only; the storage layer resolves absent macro values to the default goals at read time (new requirement — existing requirements unchanged).

## Impact

- **Database**: `alter table daily_goals` dropping NOT NULL on the three macro columns, plus one new SQL function (`set_day_burn`) in [supabase/schema.sql](../../../supabase/schema.sql); applied via the dashboard SQL editor like prior schema changes. No policy changes.
- **App code**: small — `getGoalsForDate` typing in the storage layer admits null macros, and the effective-goals derivation in `AppState` becomes a per-field merge instead of whole-object `??`. The web app does not call the new function.
- **External**: the OpenClaw machine stores the user's email/password (or a refresh token) and must compute dates in the user's local timezone using the app's `YYYY-MM-DD` text convention.
- **Security**: unchanged model — the new function is security invoker, so RLS scopes all access to the authenticated user, same as every existing table and function.

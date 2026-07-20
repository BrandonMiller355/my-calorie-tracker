## Context

The weekly deficit widget computes deficit as `effective_goal_calories − consumed_calories` per day, where the effective goal is the `daily_goals` override for that date falling back to the default `goals` row (see `week_deficit_summary` in `supabase/schema.sql`). The user maintains accuracy today by manually setting a custom goal each day. An external machine ("OpenClaw") knows the actual burn number — typically for the previous day — and should write it directly.

Current state relevant to this change:

- The app connects with the publishable key; RLS is the sole security boundary (single-user deployment, no self-service signup).
- `week_deficit_summary(p_from, p_through)` already returns per-date `consumed_calories`, so the read side needs nothing new; its goal fallback reads only `calories`, so it is unaffected by macro nullability.
- `daily_goals` currently has NOT NULL `carbs`, `protein`, `fat` columns, and the app treats an override row as a complete `Goals` object (`dayGoalOverride ?? defaultGoals` in `AppState`).
- All dates are local-calendar `YYYY-MM-DD` text, not Postgres dates.

## Goals / Non-Goals

**Goals:**

- Let an authenticated external client set a day's calorie-burn goal with a single call that touches calories and nothing else — no macro values written on insert, none overwritten on update.
- Let the same client read a day's consumed calories.
- Add zero new security surface: no edge functions, no service-role key, no shared secrets.
- Document the access pattern well enough that the OpenClaw-side script can be written from this repo alone.

**Non-Goals:**

- No UI changes beyond the effective-goals fallback; the web app never calls `set_day_burn` and the day-goal editor still saves all four values.
- No automation of the OpenClaw side itself (its script/scheduling is out of scope for this repo).
- No multi-user or API-key-based access model.
- No changes to how the weekly deficit is computed or displayed.

## Decisions

### 1. Auth: OpenClaw signs in as the app user (Option A) — no edge functions

OpenClaw authenticates against Supabase Auth (`POST /auth/v1/token?grant_type=password`) with the user's email/password and the publishable key, then calls PostgREST `rpc/` endpoints with the resulting JWT. RLS scopes everything to the user, identically to the web app.

*Alternative considered:* a dedicated edge function with `verify_jwt` disabled, a shared-secret header, and a service-role client pinned to the user's id. Rejected: it creates a second security model (secret + service role bypassing RLS) to protect a single-user app that already has a working one, and it requires deploying and maintaining new function code. The credential stored on the OpenClaw box (password or refresh token) is no more sensitive than the shared secret would have been.

### 2. Calories-only overrides: `daily_goals` macro columns become nullable

`carbs`, `protein`, `fat` drop their NOT NULL constraints; null means "no macro override for this date" and the effective macro goals fall back to the default `goals` row at read time. This makes a burn-sync row exactly what it semantically is — "this day's burn was X" — with no opinion about macros.

Consequences:

- Synced days show macro goals that track the *current* defaults (a later change to default macros applies retroactively to synced days), instead of freezing a snapshot at sync time.
- The `Goals` shape returned by `getGoalsForDate` admits null macros; the app derives effective goals with a per-field merge (override field if non-null, else default) instead of the current whole-object `??`.
- The day-goal editor keeps writing all four values, so a manual edit still pins macros concretely.

*Alternative considered:* keep NOT NULL and have the function seed macros from the `goals` row on insert. Rejected by the user: the sync should not create macro overrides it was never told about, and the snapshot behavior (stale macros after defaults change) is undesirable. It also made the function depend on the `goals` row existing.

### 3. Write path: one SQL function, `set_day_burn(p_date text, p_calories numeric)`

Security invoker (the default), matching `meal_suggestions` and `week_deficit_summary`, so RLS applies. With nullable macros the function is a trivial atomic upsert — no reads at all:

- **Insert branch**: `insert into daily_goals (date, calories) values (p_date, p_calories)` — macros default to null.
- **Conflict branch** (`on conflict (user_id, date)`): `do update set calories = excluded.calories` — only calories is overwritten; existing macro values (null or concrete) are never touched.

Overwrite semantics are deliberate: **always overwrite calories** (the previous-day sync is authoritative, replacing any mid-day estimate the user entered), **never touch macros**.

*Alternative considered:* a plain PostgREST upsert on `daily_goals` (`Prefer: resolution=merge-duplicates`), which nullable macros technically make possible. Rejected: it depends on subtle header/`on_conflict` behavior with the defaulted `user_id` column, and it leaves the overwrite semantics implicit in the client instead of pinned server-side where the app and any future client share them.

### 4. Read path: reuse `week_deficit_summary`

`POST /rest/v1/rpc/week_deficit_summary` with `{"p_from": "<date>", "p_through": "<date>"}` returns that day's `consumed_calories`. No new read function; one RPC serving both the widget and external reads keeps a single definition of "consumed."

### 5. Schema deployment convention unchanged

The `alter table` statements and the function are appended to `supabase/schema.sql` (the source of truth) and applied via the dashboard SQL editor, matching how every prior schema change shipped.

## Risks / Trade-offs

- [Password stored on the OpenClaw machine] → Same exposure class as any credential that box would hold for any auth option; single-user app, RLS-bounded blast radius. Mitigation: store it in OpenClaw's secret mechanism, not in the script.
- [Timezone drift: OpenClaw computes "yesterday" in the wrong zone and writes the wrong row] → The access-pattern documentation states the local-calendar `YYYY-MM-DD` convention explicitly; the OpenClaw script must pin the user's IANA timezone rather than using server/UTC time.
- [Sync overwrites a mid-day manual estimate the user wanted kept] → Accepted by design: the user decided the synced (actual) number always wins for calories.
- [App encounters a null-macro override row before the fallback code ships] → Sequence the rollout: deploy the app change first, then apply the schema migration and function. Until the function is first called, no null-macro rows exist.
- [Retroactive macro fallback on synced days] → Accepted, and arguably desired: macro goals on calories-only days follow the current defaults rather than a stale snapshot.

## Migration Plan

1. Ship the app change (nullable-macro typing + per-field effective-goals merge) — behavior is identical while all existing rows have concrete macros.
2. Append to `supabase/schema.sql` and run in the dashboard SQL editor: the three `alter table daily_goals ... drop not null` statements and `create function set_day_burn`.
3. Verify via an authenticated RPC call (insert case, then conflict case, confirming macros survive).
4. Rollback: `drop function set_day_burn(text, numeric);` and, if no null-macro rows have been created (or after backfilling them), restore the NOT NULL constraints. The app-side per-field merge is backward compatible either way.

## Open Questions

None — auth model, calories-only override semantics, and read path were all settled during exploration and review.

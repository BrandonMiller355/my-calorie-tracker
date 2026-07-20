# external-burn-sync Specification

## Purpose
Authenticated external (non-app) access for reading a day's consumed calories and writing a day's calorie-burn goal, so an automated client (e.g. the user's OpenClaw machine) can keep the weekly deficit accurate without manual input.

## Requirements

### Requirement: External client authenticates as the app user
An external client SHALL access the database exclusively through Supabase Auth and the PostgREST API: it signs in with the app user's email and password using the publishable key, and sends the resulting JWT on every request. No service-role key, shared secret, or edge function SHALL be part of the external access path; row-level security remains the sole security boundary.

#### Scenario: Sign-in yields a usable session
- **WHEN** the external client posts the user's email and password to the Supabase Auth token endpoint with the publishable key
- **THEN** it receives an access token (JWT) and refresh token, and requests bearing that JWT are scoped by RLS to that user's rows

#### Scenario: Unauthenticated access is rejected
- **WHEN** a request reaches the REST API without a valid user JWT
- **THEN** no user data is readable or writable

### Requirement: External client can read a day's consumed calories
The external client SHALL obtain the total calories consumed for a single local-calendar date by calling the existing `week_deficit_summary` RPC with `p_from` and `p_through` both set to that date, using the app's `YYYY-MM-DD` local-date text convention.

#### Scenario: Read consumed calories for a date
- **WHEN** the client calls `week_deficit_summary` with `p_from = p_through = "2026-07-14"`
- **THEN** the response contains one row for `2026-07-14` whose `consumed_calories` is the sum of `calories × quantity` over the user's food entries for that date, and `0` if no entries exist

### Requirement: External client can set a day's calorie-burn goal
The system SHALL provide a `set_day_burn(p_date text, p_calories numeric)` SQL function, security invoker so RLS scopes it to the calling user, that upserts the user's `daily_goals` row for `p_date` in a single atomic statement touching only the calorie value: when no row exists it inserts one with `calories = p_calories` and null carbs/protein/fat (no macro override); when a row exists it sets only `calories = p_calories` and MUST leave the existing carbs, protein, and fat values unchanged, whether null or concrete.

#### Scenario: First write for a date creates a calories-only override
- **WHEN** `set_day_burn("2026-07-14", 2740)` is called and no `daily_goals` row exists for that date
- **THEN** a row is created with calories 2740 and null carbs, protein, and fat, so that date's effective macro goals remain the defaults

#### Scenario: Repeat write overwrites calories only
- **WHEN** a `daily_goals` row for the date already exists (for example a mid-day manual estimate, possibly with customized macros) and `set_day_burn` is called for that date
- **THEN** the row's calories become the new value and its carbs, protein, and fat are exactly what they were before the call

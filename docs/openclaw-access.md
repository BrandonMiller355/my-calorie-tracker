# OpenClaw external access

How the OpenClaw machine reads a day's consumed calories and writes a day's
calorie-burn goal directly against the Supabase project. Everything here uses
the same access path as the web app: Supabase Auth plus the PostgREST API with
the **publishable key** — no service-role key, no shared secrets, no edge
functions. Row-level security is the sole boundary; the JWT scopes every
request to the app user's rows.

Values needed (same ones the app uses, see `.env.example`):

- `SUPABASE_URL` — the project URL (`VITE_SUPABASE_URL`)
- `SUPABASE_PUBLISHABLE_KEY` — the publishable key (`VITE_SUPABASE_PUBLISHABLE_KEY`)
- The app user's email and password, stored in OpenClaw's secret mechanism
  (never inline in the script)

## Dates

All dates are the app's **local-calendar `YYYY-MM-DD` text** convention, in
the user's timezone. The OpenClaw script must pin the user's IANA timezone
(e.g. `America/New_York`) when computing "yesterday" — never server time or
UTC, which flips to the wrong date for part of every day.

## 1. Sign in

```
POST {SUPABASE_URL}/auth/v1/token?grant_type=password
apikey: {SUPABASE_PUBLISHABLE_KEY}
Content-Type: application/json

{"email": "<app user email>", "password": "<password>"}
```

Response (abridged):

```json
{
  "access_token": "<jwt>",
  "refresh_token": "<refresh token>",
  "expires_in": 3600
}
```

Every subsequent request sends both headers:

```
apikey: {SUPABASE_PUBLISHABLE_KEY}
Authorization: Bearer <access_token>
```

Access tokens expire (about an hour). Either sign in fresh per sync run —
simplest for a once-a-day job — or store the refresh token and exchange it:

```
POST {SUPABASE_URL}/auth/v1/token?grant_type=refresh_token
apikey: {SUPABASE_PUBLISHABLE_KEY}
Content-Type: application/json

{"refresh_token": "<refresh token>"}
```

which returns a new access token *and a new refresh token* (persist the new
one; the old one is single-use).

## 2. Write the day's burn: `set_day_burn`

```
POST {SUPABASE_URL}/rest/v1/rpc/set_day_burn
apikey: {SUPABASE_PUBLISHABLE_KEY}
Authorization: Bearer <access_token>
Content-Type: application/json

{"p_date": "2026-07-18", "p_calories": 2740}
```

Returns `204 No Content` on success.

Semantics (fixed server-side in `supabase/schema.sql`):

- **Calories is always overwritten.** The synced actual burn is authoritative
  and replaces any value already on the row, including a mid-day manual
  estimate entered in the app.
- **Macros are never touched.** A newly created row has null carbs/protein/fat
  ("no macro override" — the app shows the current default macro goals for
  that day); an existing row keeps whatever macro values it had, null or
  concrete.

## 3. Read a day's consumed calories: `week_deficit_summary`

Reuses the app's existing RPC with both bounds set to the same date:

```
POST {SUPABASE_URL}/rest/v1/rpc/week_deficit_summary
apikey: {SUPABASE_PUBLISHABLE_KEY}
Authorization: Bearer <access_token>
Content-Type: application/json

{"p_from": "2026-07-18", "p_through": "2026-07-18"}
```

Response — one row per date in the range, so exactly one here:

```json
[
  {
    "date": "2026-07-18",
    "consumed_calories": 2215,
    "effective_goal_calories": 2740,
    "has_entries": true
  }
]
```

`consumed_calories` is the sum of `calories × quantity` over the user's food
entries for that date (`0` when none exist, with `has_entries` false).
`effective_goal_calories` is that day's burn goal after the daily override /
default fallback — after a successful `set_day_burn` it reflects the synced
value.

## Errors worth handling

- `400` from the auth endpoint — bad credentials or a consumed refresh token;
  re-authenticate with email + password.
- `401`/`403` from `rest/v1` — missing/expired JWT; refresh and retry. Without
  a valid user JWT, RLS makes every table read and write return nothing.
- `404` from `rest/v1/rpc/set_day_burn` — the function isn't deployed yet
  (see the migration steps at the end of `supabase/schema.sql`).

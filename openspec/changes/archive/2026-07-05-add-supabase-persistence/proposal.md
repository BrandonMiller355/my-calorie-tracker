## Why

V1 stores all data in browser IndexedDB, so the food log is trapped on one device and lost if site data is cleared. Moving persistence to a hosted Supabase (Postgres) backend makes data durable and reachable from any device, and the existing `StorageRepository` abstraction was designed exactly for this swap.

## What Changes

- Add a `SupabaseRepository` implementing the existing `StorageRepository` interface against Supabase Postgres (`food_entries` and `goals` tables, owner-only Row Level Security).
- Add authentication: email + password via Supabase Auth, with public signups disabled (single-user deployment). A login screen gates the app; a session persists per browser.
- **BREAKING**: Remove `IndexedDbRepository` from the runtime path. Existing local data is not migrated (accepted: no data worth migrating). The app becomes online-only; when Supabase is unreachable, the app surfaces a clear error state instead of silently failing.
- Delete `InMemoryRepository` as well — no files in `src/` that only the test suite uses. Tests that need a working repository define an in-memory fake inside the test file.
- Add repo-tracked schema SQL (tables, indexes, RLS policies) applied manually via the Supabase dashboard; project URL and publishable key supplied via `VITE_`-prefixed env vars.

## Capabilities

### New Capabilities
- `user-auth`: Sign-in with email + password, session persistence and restore, sign-out, and gating all app screens behind an authenticated session. No self-service signup.

### Modified Capabilities
- `data-persistence`: "Durable local persistence" (IndexedDB) is replaced by durable hosted persistence in Supabase scoped to the authenticated user. The "storage unavailable" scenario changes from an in-memory fallback to an online-only error state. The storage-abstraction and day-keyed-retrieval requirements are unchanged in intent but re-anchored to the remote backend.

## Impact

- **Code**: `src/storage/` (new `SupabaseRepository`, `createRepository` rewiring, `IndexedDbRepository` removed from runtime), `src/App.tsx`/`src/main.tsx` (auth gate), new login screen component, `src/state/AppState.tsx` (session awareness).
- **Dependencies**: adds `@supabase/supabase-js`; `idb` becomes removable.
- **Configuration**: new `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; `.env.local` git-ignored, `.env.example` added.
- **External**: Supabase project (free tier) created by the user in their org; schema + RLS applied via dashboard SQL editor; the single user account created manually and signups disabled.

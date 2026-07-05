## Context

V1 is a single-user React SPA persisting to IndexedDB behind the `StorageRepository` interface (`src/storage/StorageRepository.ts`), designed from the start to be swappable. The V1 design doc left "which hosted DB" as an open question; this change resolves it: Supabase (free tier), in the user's existing org. There is no data worth migrating from IndexedDB. The publishable key ships in the browser bundle, so Row Level Security plus authentication is mandatory — the key alone must grant nothing.

## Goals / Non-Goals

**Goals:**
- All entries and goals persisted in Supabase Postgres, reachable from any device after sign-in.
- Single-user auth: email + password, no self-service signup, session persists per browser.
- `SupabaseRepository` drops in behind the existing `StorageRepository` interface; UI components unchanged except the new login gate and error states.
- Schema and RLS policies tracked in the repo as SQL.

**Non-Goals:**
- Offline support or local/remote sync (the app becomes online-only).
- Data migration from IndexedDB.
- Multi-user product features, sign-up flow, password reset UI (dashboard recovery is sufficient).
- Supabase CLI / local Docker stack / migration tooling — dashboard SQL editor is enough at this scale.

## Decisions

1. **Replace, don't sync.** `SupabaseRepository` replaces `IndexedDbRepository` outright. Offline-first sync (queueing writes, reconciling conflicts) is a distributed-systems problem with no payoff for a personal tracker used online. `idb`, `IndexedDbRepository`, and `InMemoryRepository` are all deleted — no production-source files that exist only for the test suite. Tests needing a working repository define an in-memory fake of `StorageRepository` inside the test file.

2. **Auth: email + password via Supabase Auth, signups disabled.** Alternatives rejected: magic link (email round-trip each login), OAuth (more dashboard config for no gain), anonymous sign-in (a different user per browser defeats multi-device access). The account is created manually in the dashboard; "Allow new users to sign up" is turned off. The Supabase JS client persists the session in localStorage and auto-refreshes tokens.

3. **Schema mirrors the existing TypeScript model, with snake_case columns and a `user_id` owner.**
   ```sql
   create table food_entries (
     id uuid primary key,
     user_id uuid not null references auth.users default auth.uid(),
     date text not null,            -- YYYY-MM-DD local date, matches app convention
     meal text not null check (meal in ('breakfast','lunch','dinner','snacks')),
     name text not null,
     serving_desc text,
     quantity numeric not null default 1,
     calories numeric not null,
     carbs numeric not null,
     protein numeric not null,
     fat numeric not null,
     source text not null check (source in ('manual','search'))
   );
   create index food_entries_user_date on food_entries (user_id, date);

   create table goals (
     user_id uuid primary key references auth.users default auth.uid(),
     calories numeric not null,
     carbs numeric not null,
     protein numeric not null,
     fat numeric not null
   );
   ```
   `date` stays a text `YYYY-MM-DD` (not Postgres `date`) to preserve the local-calendar-date semantics and avoid timezone re-interpretation. `goals` is one row per user with `user_id` as PK; `saveGoals` is an upsert. The `(user_id, date)` index satisfies the day-keyed-retrieval requirement. RLS enabled on both tables with owner-only policies: `using (user_id = auth.uid())` for select/update/delete, `with check (user_id = auth.uid())` for insert. The SQL lives in `supabase/schema.sql` in the repo and is applied by hand in the dashboard SQL editor.

4. **Repository mapping.** `SupabaseRepository` implements `StorageRepository` 1:1: `getEntriesByDate` → `select ... eq('date', d)` (RLS scopes to the user; no client-side `user_id` filter needed, but `user_id` defaults server-side via `default auth.uid()` so the client never sends it). Column-name mapping (camelCase ↔ snake_case) is centralized in two small converter functions in the repository. Every call checks the Supabase `error` and throws, so failures propagate to the UI error state instead of being swallowed.

5. **Client and config.** One `src/lib/supabase.ts` module creates the client from `import.meta.env.VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. `.env.local` is git-ignored; `.env.example` documents the two vars. Missing env vars fail fast with a clear error at startup rather than a cryptic fetch failure.

6. **Auth gate above the router.** An `AuthProvider` (context) exposes `session` and subscribes to `onAuthStateChange`. `App` renders the login screen when there is no session and the existing routes when there is. `createRepository()` becomes trivial: construct `SupabaseRepository` once the session exists. The `RepositoryHandle.persistent` flag and its warning banner are removed along with the fallback path; error handling moves to per-operation error states per the spec. Sign-out is a button on the settings screen.

7. **Error handling: fail loudly, retry manually.** Loads show an error state with a retry button; failed writes surface a visible message and do not update the UI optimistically. No offline queue, no automatic retries.

8. **Testing.** `SupabaseRepository` unit tests mock the Supabase client (query-builder stub) to verify query shape, camel/snake mapping, and error propagation. Existing UI and state tests (currently importing `InMemoryRepository` in `App.test.tsx`) switch to an in-memory `StorageRepository` fake defined in the test file. Auth gate tested with a mocked session context. No integration tests against a live Supabase instance in CI.

## Risks / Trade-offs

- [Online-only: no connectivity means no logging] → Accepted deliberately; error states make it obvious rather than silent. Revisit sync only if it becomes a real annoyance.
- [Free tier pauses the project after ~7 days of inactivity] → Acceptable for a daily-use tracker; unpausing is one click in the dashboard, no data loss.
- [Publishable key is public] → RLS owner-only policies are the security boundary; verified by the RLS scenario in the spec. Never introduce the secret key into the frontend.
- [Schema drift between `supabase/schema.sql` and the live database (hand-applied)] → Single file, two tables; treat the repo file as source of truth and re-apply on change. Adopt the Supabase CLI only if the schema starts evolving regularly.
- [Locked out (forgotten password, no reset UI)] → Reset the password from the Supabase dashboard.

## Migration Plan

1. User-side (dashboard, once): create project → run `supabase/schema.sql` → create the user account → disable signups → copy URL + publishable key into `.env.local`.
2. Code lands behind nothing — first authenticated load starts from empty tables (no data migration by decision).
3. Rollback: revert the commits; IndexedDB data from before the switch is still on the original device untouched.

## Open Questions

None — auth model, replace-vs-sync, migration, and tier were all settled during exploration.

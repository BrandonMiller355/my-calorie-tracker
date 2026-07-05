## 1. Supabase project setup (user, in dashboard)

- [x] 1.1 Create the Supabase project in the org (free tier, nearest region); store the generated database password in a password manager
- [x] 1.2 Copy the Project URL and publishable key from Project Settings
- [x] 1.3 Create the single user account (email + password) in Authentication → Users, then disable public signups in Authentication → Sign In / Providers

## 2. Schema and config

- [x] 2.1 Add `supabase/schema.sql` with `food_entries` and `goals` tables, the `(user_id, date)` index, and owner-only RLS policies (per design.md)
- [x] 2.2 Apply `supabase/schema.sql` in the dashboard SQL editor; verify RLS is enabled on both tables
- [x] 2.3 Add `.env.example` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; add `.env.local` (git-ignored) with real values; ensure `.gitignore` covers `.env.local`
- [x] 2.4 Add `@supabase/supabase-js` dependency; create `src/lib/supabase.ts` client module that fails fast when env vars are missing

## 3. Auth

- [x] 3.1 Create `AuthProvider` context exposing the session, subscribed to `onAuthStateChange`
- [x] 3.2 Create the login screen (email + password form, error message on invalid credentials, no signup option)
- [x] 3.3 Gate all routes in `App.tsx` behind the session; show the login screen when unauthenticated
- [x] 3.4 Add sign-out action to the settings screen
- [x] 3.5 Tests: auth gate renders login when no session and routes when a session exists (mocked session context)

## 4. Supabase repository

- [x] 4.1 Implement `SupabaseRepository` (all six `StorageRepository` methods; `saveGoals` as upsert; camelCase↔snake_case converters; throw on Supabase `error`)
- [x] 4.2 Rewire `createRepository()` to construct `SupabaseRepository` for the authenticated session; remove the `persistent` flag and in-memory runtime fallback
- [x] 4.3 Remove `IndexedDbRepository` and `InMemoryRepository`, their tests, and the `idb` and `fake-indexeddb` dependencies; replace `InMemoryRepository` usage in `App.test.tsx` with an in-memory `StorageRepository` fake defined in the test file
- [x] 4.4 Tests: `SupabaseRepository` query shape, field mapping, and error propagation against a mocked Supabase client

## 5. Error states

- [x] 5.1 Show an error state with retry when loading a day's entries or goals fails
- [x] 5.2 Surface failed writes (add/update/delete/save goals) to the user without showing the change as persisted; remove the old "data won't be saved" banner
- [x] 5.3 Tests: load failure shows retry state; write failure shows error and does not update the log

## 6. Verification

- [x] 6.1 Full test suite passes; typecheck and build succeed
- [x] 6.2 Manual end-to-end check: sign in, log an entry, reload (entry persists), sign out (login screen returns), and confirm rows in the Supabase table editor

## Context

Today the add-food form (`src/components/EntryForm.tsx`) has a plain text Name field. Foods come from either manual entry or the Open Food Facts search screen (`src/screens/SearchScreen.tsx`), which hands a one-shot `prefill` back to the day log via router navigation state. Nothing the user logs is remembered: every repeat food is retyped or re-searched.

Persistence is Supabase Postgres behind the `StorageRepository` interface, with per-user RLS (`supabase/schema.sql`). App state lives in a single `AppState` provider that loads the current day's entries. The app is online-only, single-user-per-account, and data volumes are tiny (hundreds of rows).

Decisions here were settled in an explore session: self-populating library, per-meal suggestions (3 recent + 3 most used), library-first combobox with explicit online-search escalation, silent auto-capture, snapshot semantics, archive instead of delete, no backfill.

## Goals / Non-Goals

**Goals:**

- Logging a previously eaten food takes one tap from the name field.
- The library populates itself; no curation required to get value.
- Library stays small and loads fully client-side in one query per session.
- Canonical food values are editable in exactly one place (library screen) and never rewrite logged entries.

**Non-Goals:**

- No backfill from existing `food_entries` and no LoseIt/CSV import (may come later as separate changes).
- No serving-size unit conversions, extra nutrients, barcode scanning, or shared/public foods.
- No offline support beyond what exists today.
- No "copy yesterday's meal" (separate feature).

## Decisions

### D1: Dedicated `foods` table, deduplicated on normalized name

```sql
create table foods (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  description text,
  serving_desc text,
  calories numeric not null,
  carbs numeric not null,
  protein numeric not null,
  fat numeric not null,
  source text not null check (source in ('manual', 'search')),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create unique index foods_user_name on foods (user_id, lower(trim(name)));
```

- The unique index on `(user_id, lower(trim(name)))` is the dedup key: logging "PB&J" twice yields one library row, and it makes any future import idempotent.
- `archived_at` (timestamp, not boolean) implements archive-not-delete; archived foods are excluded from suggestions and combobox matches but remain joinable from old entries.
- No `use_count` / `last_used_at` columns: per-meal frequency and recency are derived from `food_entries` (see D3), so denormalized counters would only drift.
- Alternative considered — derive the library entirely from `food_entries` with no new table: rejected because it cannot hold descriptions, canonical edits, archived state, or not-yet-logged foods.

### D2: `food_entries.food_id` nullable FK; entries keep macro snapshots

```sql
alter table food_entries add column food_id uuid references foods (id);
```

- Entries continue to store their own name/macros (snapshot semantics): editing a library food never changes history; a one-off tweak while logging never corrupts the library.
- `food_id` exists purely for provenance and to power per-meal suggestion queries. It is null for pre-existing rows and stays nullable forever.
- FK has no `on delete cascade` — foods are archived, not deleted, so dangling references cannot occur through the app.

### D3: Per-meal suggestions via one Postgres function

"3 most recently logged + 3 most used for this meal, deduped" needs `GROUP BY` over `food_entries`, which supabase-js cannot express. A single SQL function keeps it one round trip:

```sql
create function meal_suggestions(p_meal text)
returns table (food foods, suggestion_group text) ...
```

- Recent = distinct `food_id` for entries with `meal = p_meal`, ordered by most recent `date`, limit 3.
- Most used = distinct `food_id` for the same meal ordered by entry count desc (ties broken by recency), excluding the recent 3, limit 3. Archived foods excluded from both. Lists come up short rather than padding from other meals.
- The function is `security invoker` (default), so existing RLS on both tables applies; no new policy surface.
- Alternative considered — two client queries + join in JS: more round trips and supabase-js still can't do the frequency aggregation without fetching every entry for the meal.

### D4: Library loaded once per session; matching is client-side

- A new load in `AppState` fetches all non-archived foods at startup (same pattern as default goals). Add/edit/archive and auto-capture update this in-memory list optimistically.
- Combobox matching runs over the in-memory list against `name + ' ' + description`, case-insensitive, ranked: prefix match > word-boundary match > substring. No fuzzy-matching dependency — at a few hundred rows, simple ranking is enough and keeps the bundle small.
- Alternative considered — server-side `ilike` search per keystroke: rejected; adds latency to every keystroke for a dataset that fits trivially in memory.

### D5: Combobox is a small in-house component

The project has no UI component dependencies and the existing forms are hand-rolled. Build a minimal ARIA combobox (input + listbox, arrow/enter/escape keys) rather than adding downshift/react-aria. Sections: suggestion groups when empty, library matches when typing, and two fixed action rows ("Search online for '…'", "Use '…' as a new food"). Free text always resolves to the manual path — no dead ends.

### D6: Auto-capture on add, link-only when the name already exists

On `addEntry` (not on edit):

1. If the user picked a library food → set `food_id`; do not touch the food row even if macros were tweaked in the form.
2. Else (free text or online-search prefill) → look up by normalized name. If found, link to it (again, no update). If not found, insert a new `foods` row from the form values (`source: 'manual' | 'search'`) and link.

Last-write-wins updates from the log form are deliberately excluded: one-off adjustments ("extra oil today") must not silently become the canonical values. Canonical edits happen only on the library screen. Failure to upsert the library row should not fail the entry save (capture is best-effort; entry persistence is the critical path).

### D7: Description lives on the library food, not on entries

The form shows a Description input when the typed name doesn't match an existing library food (it seeds the new food row). When an existing library food is selected, its description displays read-only under the name; changing it requires the library screen. Description renders as the secondary line in the combobox and participates in matching. Day-log rows do not show descriptions.

### D8: Online search stays a route; navigation state carries the form context

The combobox's "Search online" row navigates to the existing `/search` route carrying `{ returnTo, meal, date }` in router state; selecting a result navigates back with `{ prefill, meal }` so the re-opened `EntryForm` restores the selected meal. The standalone search entry point keeps working unchanged (falls back to current behavior when no form context is present). Alternative considered — embed search as a step inside the modal: better containment but duplicates an already-working screen; not worth it now.

### D9: Library management screen as its own nav tab

New `/foods` route with a "Foods" tab in the bottom nav (revised from a Settings link during implementation — it's a destination, not a setting): lists library foods with name/description/macros, supports create ("add food item"), edit, and archive. Reuses the validation rules from `src/lib/validation.ts`. Archived foods hidden by default.

## Risks / Trade-offs

- [Name-keyed dedup merges genuinely different foods with the same name] → Acceptable for a personal library; the description field and rename-in-library give an escape hatch. Two distinct foods just need distinct names.
- [Best-effort auto-capture can silently skip saving a food] → Entry save still succeeds (the important part); the food gets captured on a later log. No user-facing error needed.
- [In-memory library goes stale across devices in a long-lived session] → Single-user app; staleness resolves on reload. Accepted.
- [SQL function adds a second deployment artifact beyond tables] → It lives in `supabase/schema.sql` like everything else and is exercised through `StorageRepository`, so the swappable-backend rule still holds (test fake implements the same method in JS).
- [Combobox accessibility is easy to get subtly wrong in-house] → Keep scope minimal (listbox pattern, no portals/virtualization) and cover keyboard interaction in component tests.

## Migration Plan

Purely additive: new table + index + policies + function, one nullable column on `food_entries`. Apply via the Supabase dashboard SQL editor (per existing convention in `supabase/schema.sql`). Existing rows and clients are unaffected; rollback is dropping the new objects and column.

## Open Questions

None blocking. Deferred by decision: import tooling, copy-meal, barcode scan.

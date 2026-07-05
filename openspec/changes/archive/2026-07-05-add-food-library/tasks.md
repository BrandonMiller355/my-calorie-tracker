## 1. Schema & types

- [x] 1.1 Add `foods` table, `foods_user_name` unique index, RLS policies, and `meal_suggestions(p_meal)` function to `supabase/schema.sql`; add nullable `food_id` column (FK to `foods`) to `food_entries`
- [x] 1.2 Apply the schema changes to the Supabase project via the dashboard SQL editor
- [x] 1.3 Add `LibraryFood` type to `src/types.ts` (name, description?, servingDesc?, macros, source, archivedAt?) and add optional `foodId` to `FoodEntry`

## 2. Storage layer

- [x] 2.1 Extend `StorageRepository` with library methods: `getFoods()` (non-archived), `addFood`, `updateFood`, `archiveFood`, `getMealSuggestions(meal)` returning recent/most-used groups
- [x] 2.2 Implement the new methods in `SupabaseRepository` (suggestions via `rpc('meal_suggestions')`), including row↔model mapping for `foods` and `food_id` on entries
- [x] 2.3 Update `SupabaseRepository` tests and any in-memory test fakes to cover the new methods

## 3. Library state & capture

- [x] 3.1 Load the full library once in `AppState` (same pattern as default goals) and expose `foods` plus `addFood`/`updateFood`/`archiveFood` actions that update the in-memory list
- [x] 3.2 Implement auto-capture in the add-entry flow: link entry to selected/matching library food by normalized name, insert a new food when unmatched, never update an existing food's values, and never fail the entry save on capture errors
- [x] 3.3 Add a client-side matcher over name + description (case-insensitive; ranked prefix > word-boundary > substring) in `src/lib/` with unit tests

## 4. Name combobox in EntryForm

- [x] 4.1 Build a minimal accessible combobox component (input + listbox, arrow/enter/escape keys, grouped sections, fixed footer action rows)
- [x] 4.2 Wire it into `EntryForm` as the Name field: empty+focused shows per-meal suggestions (via `getMealSuggestions`, refetched when meal changes), typing shows library matches with description as secondary line
- [x] 4.3 Selecting a library food pre-fills macros/serving description and records the food id; free text falls through to the existing manual path
- [x] 4.4 Add Description handling to the form: editable input when the name matches no library food (seeds the new food), read-only display when a library food is selected
- [x] 4.5 Component tests: suggestion groups dedupe and stay per-meal, description matching, keyboard interaction, free-text fallback

## 5. Online search escalation

- [x] 5.1 Add the "Search online for '…'" footer action navigating to `/search` with `{ returnTo, meal, date }` router state
- [x] 5.2 On result selection with form context present, navigate back re-opening `EntryForm` with the prefill and preserved meal; keep standalone search behavior unchanged
- [x] 5.3 Tests for the round trip (meal preserved) and the standalone path

## 6. Library management screen

- [x] 6.1 Create `/foods` route and screen: list non-archived foods (name, description, macros), as its own "Foods" tab in the bottom nav
- [x] 6.2 Add create ("add food item") and edit forms reusing `src/lib/validation.ts` rules
- [x] 6.3 Add archive action; archived foods disappear from the list, suggestions, and matching, while past entries remain intact
- [x] 6.4 Screen tests: create, edit (does not rewrite past entries), archive

## 7. Verification

- [x] 7.1 Run the full test suite and typecheck
- [x] 7.2 Manually verify end-to-end: log new food → auto-captured; re-log via suggestion; tweak macros without overwriting library; search-online round trip preserves meal; archive hides food

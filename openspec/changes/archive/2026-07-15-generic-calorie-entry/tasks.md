## 1. Schema and data model

- [x] 1.1 Update `supabase/schema.sql`: add `description text` to `food_entries`, widen the `source` check to `('manual', 'search', 'quick')`, and fix the comment near line 144 that says description is never snapshotted onto entries
- [x] 1.2 Write the dashboard migration SQL (in the schema file or as a comment block): `alter table food_entries add column description text;` plus drop/re-add of the `source` check constraint — flag that this must be run in the Supabase dashboard **before** deploying app code
- [x] 1.3 Extend `FoodEntry` in `src/types.ts`: `description?: string` and `source: 'manual' | 'search' | 'quick'`
- [x] 1.4 Map `description` in `toRow`/`fromRow` in `src/storage/SupabaseRepository.ts`

## 2. State: bypass library capture

- [x] 2.1 In `AppState.tsx` `addEntry`, skip the entire capture/match/link branch when `source === 'quick'`, and persist the entry's `description`; keep `updateEntry` paths passing `description` through
- [x] 2.2 Add/extend AppState tests: quick save calls `addFood` never, entry saved with `foodId` undefined even when a library food named "Calories" exists (covered in `EntryForm.test.tsx` through a real `AppProvider`)

## 3. Entry point and quick form

- [x] 3.1 Add a "Log calories only" fixed action to `FoodNameCombobox` rendered as the last dropdown item, present in both the empty-field and typing states (search/new-food actions remain typing-only) — implemented in `EntryForm`'s `actions` list, which the combobox renders last
- [x] 3.2 Add quick mode to `EntryForm`: static "Calories" title in place of the name field, calories input (required) plus carbs/protein/fat inputs (optional, blank = 0) with existing validation, optional description input; hide amount/unit, serving, recipe, and "Edit nutrition" UI
- [x] 3.3 On quick submit, build the entry per design (name "Calories", amount 1, unit/servingLabel 'serving', quantity 1, entered macros defaulting to 0, source 'quick', description) and save via `addEntry`
- [x] 3.4 Open `EntryForm` directly in quick mode when editing an entry with `source === 'quick'`, prefilled with its calories and description
- [x] 3.5 Component tests: action visible at bottom in both combobox states; quick form validates calories and macros; quick submit produces the fixed field shape with entered macros; editing a quick entry shows the quick form

## 4. Day-log display

- [x] 4.1 In `MealSection`, when `entry.source === 'quick'`, show `entry.description` (when present) in the caption where the quantity segment normally appears, followed by the usual macro breakdown
- [x] 4.2 Test: quick entry row renders name "Calories", description leading the caption, macro breakdown, and calorie value

## 5. Data cleanup and verification

- [x] 5.1 Run the one-off cleanup SQL in the Supabase dashboard: null `food_entries.food_id` where it references archived foods named "Calories" (normalized match), then delete those `foods` rows
- [x] 5.2 Run the full test suite and verify end-to-end in the app: log a quick entry, confirm it appears with description and correct totals, confirm the library gained no food, edit it, delete it (test suite passes — 329/329; migration + cleanup SQL run and verified in-app by Brandon)

## 1. Data model & persistence

- [x] 1.1 Add `skip_macro_check boolean not null default false` to the `foods` table in `supabase/schema.sql` (with a comment noting it suppresses the mismatch warning; run in the dashboard before deploying code).
- [x] 1.2 Add `skipMacroCheck?: boolean` to `LibraryFood` in `src/types.ts` (documented as off by default).
- [x] 1.3 Map the column in `SupabaseRepository`: add `skip_macro_check: boolean` to `FoodRow`, set it in `toFoodRow` (`food.skipMacroCheck ?? false`), and read it in `fromFoodRow` (`row.skip_macro_check || undefined`).

## 2. Capture seed plumbing

- [x] 2.1 Extend `NewEntryInput` in `src/state/AppState.tsx` with a capture-only `skipMacroCheck?: boolean` seed (alongside `description`/`recipe`), documented as seeding the captured food only.
- [x] 2.2 In `AppState.addEntry`, destructure the seed and set `skipMacroCheck` on the food object built during auto-capture; ensure it is not written onto the `food_entries` row.

## 3. EntryForm read/write behavior

- [x] 3.1 In `confirmMacroMismatch` (`src/components/EntryForm.tsx`), return `true` without prompting when `matchedFood?.skipMacroCheck` is set.
- [x] 3.2 Have `confirmMacroMismatch` report whether the user chose "Save anyway" on a real mismatch (so the save paths can flag the food), without changing its cancel behavior.
- [x] 3.3 On "Save anyway" for a brand-new food (no `matchedFood`): pass `skipMacroCheck: true` into `addEntry`.
- [x] 3.4 On "Save anyway" for an existing linked food (`matchedFood` present, in both the add and edit-entry paths): after the entry saves, call `updateFood({ ...matchedFood, skipMacroCheck: true })`, skipping the write when the flag is already set.
- [x] 3.5 Confirm the `quick` branch neither reads nor sets the flag (still warns every time).

## 4. Library screen warning

- [x] 4a.1 Extract a shared `macroMismatchMessage(mismatch)` helper in `src/lib/macroCheck.ts` and use it in `EntryForm` so both call sites word the prompt identically.
- [x] 4a.2 In `FoodsScreen`'s `FoodForm.save`, run `checkMacroCalories` before saving: skip when the edited food already opts out (a fork starts fresh), otherwise warn on a mismatch and abort on cancel; set `skipMacroCheck: true` on the saved food when the user proceeds.
- [x] 4a.3 Add `FoodsScreen` tests: edit-into-mismatch warns and cancel aborts; save-anyway sets the flag; an opted-out food never warns and keeps the flag; a fork of an opted-out food still warns.

## 5. Tests

- [x] 5.1 `macroCheck` math tests unchanged; add/adjust `EntryForm` tests: flagged linked food saves with no confirm; unflagged mismatch shows confirm.
- [x] 5.2 Test "Save anyway" on an existing linked food sets its flag (via `updateFood`) and a subsequent log is silent.
- [x] 5.3 Test "Save anyway" on a brand-new mismatched food captures it with the flag set (seed reaches `addEntry`), so the next log is silent.
- [x] 5.4 Test a mismatched quick entry still warns and creates/links/flags no food.
- [x] 5.5 Update `SupabaseRepository` tests for the new column round-trip (`toFoodRow`/`fromFoodRow`).

## 6. Verify

- [x] 6.1 Run the full test suite and typecheck.
- [x] 6.2 Manually verified end-to-end in the browser (migration applied; a hard reload was needed to clear a stale bundle): Food Library add with beer-like numbers shows the warning and opts the food out. Also covered by the `EntryForm`/`FoodsScreen` integration tests.

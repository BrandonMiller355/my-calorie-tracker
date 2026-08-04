## Why

Some foods legitimately have calories that the tracked macros (carbs, protein, fat) can't account for — alcohol (7 kcal/g) is the common case, so beer and liquor always trip the "macros don't add up" confirm on every single log. Re-confirming a known-fine food every time is pure friction. The user should be able to silence the warning permanently for a specific food while still getting caught on genuine data-entry mistakes for everything else.

## What Changes

- Library foods gain a per-food flag ("skip macro/calorie mismatch check").
- When saving an entry whose linked library food already has the flag set, the mismatch confirm dialog is **not shown at all** — the entry saves silently.
- When the mismatch dialog **does** fire and the user chooses "Save anyway", the flag is set to `true` on that food, so it never nags again for that item.
- The same warning now also fires when creating or editing a food directly on the Food Library screen (previously it warned only at logging time). It honors the same per-food flag: an opted-out food is not warned, and saving a mismatch anyway there opts the food out too. A fork ("save as new food") starts fresh (does not inherit the source food's opt-out).
- The existing native `window.confirm` is kept as-is: no checkbox, no custom modal. Clicking "Save anyway" once *is* the consent.
- Quick calories-only entries (which never link a library food) never participate — their mismatch check is unchanged.

## Capabilities

### Modified Capabilities
- `food-logging`: Specify the macro/calorie mismatch warning — when it fires, that a linked food flagged to skip suppresses it entirely, and that confirming "Save anyway" sets that food's skip flag.
- `food-library`: A library food additionally records a "skip macro/calorie mismatch check" flag (default off), and creating/editing a food on the library screen warns on a mismatch and honors/sets that flag.

## Impact

- `src/lib/macroCheck.ts` — mismatch math unchanged; adds a shared `macroMismatchMessage` helper so both call sites word the prompt identically.
- `src/components/EntryForm.tsx` — `confirmMacroMismatch` reads the linked food's flag to skip, and sets it on "Save anyway".
- `src/screens/FoodsScreen.tsx` — the library create/edit form runs the same mismatch check, honoring and setting the flag.
- `src/types.ts` — `LibraryFood` gains the flag field.
- `src/storage/StorageRepository.ts` + `SupabaseRepository` — load and persist the flag.
- `supabase/schema.sql` — new boolean column on `foods` (default false), applied via the dashboard.
- Quick entries and the `food_entries` table are untouched — the flag lives on `foods` only.

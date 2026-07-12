## 1. Data model

- [x] 1.1 Add nullable `recipe text` column to `foods` in `supabase/schema.sql`
- [x] 1.2 Add `recipe?: string` to `LibraryFood` in `src/types.ts`
- [x] 1.3 Add `recipe` to `FoodRow`, `toFoodRow`, and the row-to-`LibraryFood` mapping in `src/storage/SupabaseRepository.ts` (same nullable pattern as `description`)
- [x] 1.4 Add `recipe` to `meal_suggestions` in `supabase/schema.sql` if suggestions need to carry it through to the entry form's matched-food display; otherwise confirm the matched food is looked up from the already-loaded library list instead

## 2. Food Library screen (write + read)

- [x] 2.1 Add `recipe` to `FoodFormValues` and `toFormValues` in `src/screens/FoodsScreen.tsx`
- [x] 2.2 Add a recipe textarea to `FoodForm`, revealed by a toggle/button next to the Description field (collapsed by default when editing a food that already has one, so long text doesn't dominate the form)
- [x] 2.3 Include `recipe` in the parsed values passed to `addFood`/`updateFood`
- [x] 2.4 Add a collapsed "View recipe" disclosure per row in the library list, shown only when `food.recipe` is present

## 3. Entry form (write on new food, read on matched food)

- [x] 3.1 Add local `recipe` state in `EntryForm.tsx`, alongside the existing `description` state
- [x] 3.2 Add a toggle/button next to the Description field, visible under the same `showAnchorEditor` condition as description, revealing a recipe textarea
- [x] 3.3 Include `recipe.trim() || undefined` in the values passed on submit so it's saved on the newly captured library food (plumbed through `NewEntryInput` in `AppState.tsx`, mirroring `description`)
- [x] 3.4 Add a collapsed "View recipe" control next to `matchedFood?.description` (near `EntryForm.tsx:529`), shown only when `matchedFood?.recipe` is present, with no control at all when there's nothing to show or set

## 4. Validation

- [x] 4.1 Add `recipe` to `FoodFormValues`/`ParsedFoodValues` in `src/lib/validation.ts` as optional free text with no format constraints (recipe follows `description`'s pattern — a side channel outside `EntryFormValues`, not part of entry validation)

## 5. Tests

- [x] 5.1 `SupabaseRepository`: recipe round-trips through create/update, null when absent
- [x] 5.2 `FoodsScreen`: create/edit a food with a recipe; collapsed view expands to show it; omitting a recipe still saves the food
- [x] 5.3 `EntryForm`: recipe entered while defining a new food is captured onto the new library food; a matched food's existing recipe is viewable but not editable from the entry form; no recipe control appears when editing an existing entry or when there's nothing to show or set

## 6. Manual verification

- [x] 6.1 Apply the schema change to the Supabase project (dashboard SQL editor, per the note at the top of `supabase/schema.sql`)
- [x] 6.2 Log a brand-new food end to end with a recipe, then reselect it later and confirm the recipe is viewable
- [x] 6.3 Add a recipe to an existing library food from the Food Library screen and confirm it appears next time that food is matched while logging

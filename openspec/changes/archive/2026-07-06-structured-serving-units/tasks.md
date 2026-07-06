# Tasks: structured-serving-units

## 1. Unit model (pure lib)

- [x] 1.1 Add unit types and anchor types to `src/types.ts`: `WeightUnit`, `VolumeUnit`, `MeasureUnit`, `ServingSize { amount, unit }`; replace `servingDesc` with `servingLabel` + `servingSize?` on `LibraryFood`, `FoodSearchResult`, and `FoodEntry` (entries also gain `amount` and `unit`; `quantity` keeps its multiplier role)
- [x] 1.2 Create `src/lib/units.ts`: unit constants and display labels, conversion factors through per-dimension base units (g, ml), `unitDimension()`, `availableUnits(anchor)` (count label + same-dimension measure units when an equivalence exists), `deriveQuantity(amount, unit, anchor)`
- [x] 1.3 Unit-test `units.ts`: intra-dimension conversions, count vs measure derivation (45 g of "1 serving = 100 g" → 0.45; 1 oz of "= 28.3495 g" → 1), count-only foods offer only the label, weight anchors never offer volume units

## 2. Validation

- [x] 2.1 Update `src/lib/validation.ts`: entry form validates `amount` > 0 (replacing `quantity`) and a unit that is valid for the current anchor; food/anchor validation requires equivalence amount > 0 when a unit is set, defaults blank label to "serving", and rejects the nine measure-unit names as labels
- [x] 2.2 Update validation tests for the new rules

## 3. Storage

- [x] 3.1 Update `supabase/schema.sql`: on `foods` and `food_entries` drop `serving_desc`, add `serving_label text not null default 'serving'`, `serving_size_amount numeric`, `serving_size_unit text` (check: unit in the nine units; amount/unit both null or both set); on `food_entries` also add `amount numeric not null` and `unit text not null` (check: a measure unit or equal to the row's `serving_label`); update `meal_suggestions` to return the anchor columns
- [x] 3.2 Write the one-time apply snippet (ALTER/drop + recreate `meal_suggestions`; truncating affected tables is acceptable) and run it in the Supabase SQL editor (run by owner 2026-07-05; verified via REST probes)
- [x] 3.3 Update `SupabaseRepository` row mapping for entries, foods, and meal suggestions; update `StorageRepository` docs if signatures change; update repository tests

## 4. Open Food Facts mapping

- [x] 4.1 Add `serving_quantity`, `serving_quantity_unit`, `nutrition_data_per` to the requested fields and `OffProduct`; map to structured anchors per the food-search delta (per-serving + parseable g/ml quantity → equivalence; per-100g/100ml fallback → "1 serving = 100 g/ml"; anything unusable → count-only anchor)
- [x] 4.2 Update `openFoodFacts.test.ts`: per-serving with quantity, per-100g fallback, per-100ml (`nutrition_data_per: "100ml"`), missing/zero/odd-unit serving quantity degrades to count-only

## 5. Entry form

- [x] 5.1 Replace the "Servings" input in `EntryForm` with `[amount][unit ▾]`; options come from `availableUnits` of the active anchor (editing → the entry's own snapshot; library/search prefill → the food's anchor); default amount 1, unit = count label; derive `quantity` on save and store amount, unit, and anchor snapshot on the entry
- [x] 5.2 Add the inline serving-definition row for new-food names (label input with "serving" placeholder, optional `= [amount][unit ▾]` equivalence) feeding the logging unit picker live; pass the anchor through auto-capture
- [x] 5.3 Update `FoodNameCombobox` prefill payload to carry the anchor instead of `servingDesc` (no combobox change needed — it passes whole `LibraryFood` objects; `selectFood` now reads the anchor from them)
- [x] 5.4 Update EntryForm/App/combobox tests: log by weight, count-only food, edit after library anchor change uses the snapshot, inline anchor definition round-trips into the library

## 6. Foods screen

- [x] 6.1 Replace the serving-description field in the `FoodsScreen` food form with the label + equivalence row (same component/validation as 5.2)
- [x] 6.2 Update FoodsScreen tests: edit anchor, reserved-label rejection, past entries unaffected (covered in App.test "Structured serving units" + shared validateServingAnchor unit tests)

## 7. Finish (initial implementation)

- [x] 7.1 Sweep remaining `servingDesc`/`serving_desc` references (search results list in `SearchScreen`, CSS, test fixtures) and remove the dead field everywhere
- [x] 7.2 Run full test suite and typecheck; verify end-to-end in the app: define "can (drained) = 120 g", log 45 g, confirm day totals scale correctly (170 tests + typecheck + build pass; the can-drained/45 g flow runs through the real form components in App.test; live schema verified via REST after apply.sql)

## 8. Collapsed nutrition + live preview (gripe #1)

- [x] 8.1 EntryForm: hide calorie/macro inputs behind an "Edit nutrition" action for known foods (editing, prefill, or library selection); show a live computed line (per-serving × derived multiplier) and a per-serving reference line; keep inputs visible for new foods and for search prefills with missing nutrients; label visible inputs "per 1 <label>"
- [x] 8.2 Update tests: computed preview tracks amount/unit; edit-entry and one-off-tweak flows click "Edit nutrition" first; missing-macro prefill stays expanded; tweak still doesn't overwrite the library (171 tests pass; also fixed a pre-existing leaky-mock failure in the user-added search-retry test)

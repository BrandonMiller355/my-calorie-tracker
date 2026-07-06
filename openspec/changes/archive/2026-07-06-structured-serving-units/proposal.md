# Proposal: structured-serving-units

## Why

Servings today are a free-text description plus a bare multiplier: nutrition is stored "per 1 serving" and the user scales it by typing a decimal quantity. When a food's data is per-100g (the common Open Food Facts fallback) and the user ate 45 g, they must compute `0.45` in their head. There is also no way to name what a serving actually is ("can (drained)", "slice") or to log the same food by weight one day and by count the next. LoseIt-style structured units — weight, volume, and customizable count labels — remove that friction.

## What Changes

- Library foods gain a structured **serving anchor**: a customizable count label (`servingLabel`, default "serving", e.g. "can (drained)") and an optional equivalence (`servingSize`: amount + unit) in exactly one dimension — weight (g, oz, lb, kg) or volume (ml, fl oz, cup, tbsp, tsp).
- Logging an entry becomes **amount + unit** instead of a bare servings multiplier. The unit picker offers the food's count label plus, when an equivalence exists, all units of that dimension. Units interconvert within a dimension only — never weight↔volume (**no density/cross-dimension conversion**).
- The entry's `quantity` (servings multiplier) is derived once at save time; totals math is unchanged.
- Entries **snapshot the anchor trio** (label, size amount, size unit) alongside the logged amount + unit, so old entries stay self-contained and editable even after the library food's definition changes.
- Open Food Facts search reads `serving_quantity` / `serving_quantity_unit` to populate the equivalence; the per-100g fallback becomes an explicit "1 serving = 100 g" (or 100 ml) anchor, so per-100g foods can be logged directly by weight.
- The Foods screen gains editing of the serving label and equivalence.
- **BREAKING**: free-text `servingDesc` is removed from entries, library foods, and search results; the `food_entries` and `foods` schemas change. No data migration — existing rows are disposable per project owner.

## Capabilities

### New Capabilities

- `serving-units`: the unit model itself — dimensions, the fixed unit set, intra-dimension conversion, the serving anchor (label + equivalence), and derivation of the servings multiplier from a logged amount + unit.

### Modified Capabilities

- `food-logging`: entries record amount + logged unit + anchor snapshot instead of free-text serving description; the entry form replaces the "Servings" input with amount + unit picker; editing an entry resolves units from the entry's own snapshot.
- `food-library`: library foods carry the serving anchor; auto-capture stores the anchor from the form; the management screen edits label and equivalence; selection pre-fills the unit picker.
- `food-search`: mapped results carry a structured anchor from OFF serving fields; per-100g/per-100ml fallback becomes an explicit weight/volume anchor.
- `data-persistence`: `foods` and `food_entries` columns change from `serving_desc` free text to structured anchor/unit columns.

## Impact

- **Types**: `LibraryFood`, `FoodEntry`, `FoodSearchResult` in `src/types.ts` (drop `servingDesc`, add structured fields); new unit types/constants.
- **New lib**: unit definitions + conversion + multiplier derivation (pure functions, unit-tested).
- **UI**: `EntryForm` (amount + unit picker, "per what?" affordance for new foods), `FoodsScreen` (anchor editing), `FoodNameCombobox` pre-fill payload.
- **API**: `openFoodFacts.ts` mapping (`serving_quantity`, `serving_quantity_unit` fields added to the request).
- **Storage**: `StorageRepository` interface, `SupabaseRepository`, `supabase/schema.sql` (breaking column changes, no migration).
- **Totals**: `src/lib/totals.ts` unchanged — `quantity` remains the multiplier.

## 1. Data model & helpers

- [x] 1.1 Add `SavedMeal` and `MealComponent` types to `src/types.ts` (references only, `archivedAt?`), with a comment noting `SavedMeal` renders as "Meal" in the UI to avoid colliding with the `Meal` slot type.
- [x] 1.2 Add a `src/lib/meal.ts` helper that resolves a `SavedMeal`'s components against a `LibraryFood[]`, returning per-component contributions (reusing `deriveQuantity` from `lib/units`) and the live total, and reporting which components are unresolvable.
- [x] 1.3 Add `matchMeals` (name-only, case-insensitive) to `src/lib/foodMatch.ts` alongside `matchFoods`, plus `normalizeFoodName`-based dedup lookup for saved meals.
- [x] 1.4 Add saved-meal form validation to `src/lib/validation.ts` (non-empty name, ≥1 component, per-component amount/unit valid against the component food's anchor).
- [x] 1.5 Unit tests for `lib/meal.ts`, `matchMeals`, and the new validation.

## 2. Persistence

- [x] 2.1 Add `getMeals` / `addMeal` / `updateMeal` / `archiveMeal` to the `StorageRepository` interface (archived meals excluded from `getMeals`).
- [x] 2.2 Implement the four methods in `SupabaseRepository`, including the `saved_meals` table/columns (id, name, components JSON, archivedAt) and per-user scoping consistent with foods.
- [x] 2.3 Update `SupabaseRepository` tests to cover meal CRUD and archived exclusion.
- [x] 2.4 **Manual deploy step (user):** apply the `saved_meals` table, unique index, and RLS policies from `supabase/schema.sql` in the Supabase dashboard SQL editor (or against the local stack). Required before Save meal works — nothing runs `schema.sql` automatically.

## 3. App state

- [x] 3.1 Load saved meals in `AppState` (silent-degrade on failure, mirroring `getFoods`), add `meals` to state and the reducer actions (loaded/added/updated/archived).
- [x] 3.2 Expose `addMeal` / `updateMeal` / `archiveMeal` from the context.
- [x] 3.3 Add `logMeal(mealId, slot, date)` that resolves available components via `lib/meal.ts`, builds one `NewEntryInput` per component (food snapshot + anchor, derived `quantity`, `foodId`, `source: 'manual'`), and calls the existing `addEntry` for each; skips unresolvable components; no-op with a signal when none resolve.
- [x] 3.4 Tests for `logMeal` fan-out, skip-unavailable, and all-unavailable behavior.

## 4. Meal builder & management UI

- [x] 4.1 Add a `MealBuilder` component: working component list seeded from selected foods (default `{ amount: 1, unit: food.servingLabel }`), per-component amount/unit editing (units from `availableUnits`), add/remove component, name field, live total, dedup + validation on save.
- [x] 4.2 Add Foods/Meals tabs to `FoodsScreen`; keep the existing foods list + filter under the Foods tab.
- [x] 4.3 Add multi-select mode to the Foods tab (select ≥2 foods → "Create meal from N foods" → open `MealBuilder`).
- [x] 4.4 Build the Meals tab: list saved meals with live total and an expandable component breakdown; edit (reopen `MealBuilder`) and archive actions.
- [x] 4.5 Tests for the builder (seed, portion edit, validation, dedup) and the Meals tab (list, expand, edit, archive).

## 5. Logging a meal from the picker

- [x] 5.1 Add a `LogMealSheet` confirm component: lists components with portions, live total, target slot selector, "N unavailable" note, and "Log all" → calls `logMeal`; disables logging when all components are unavailable.
- [x] 5.2 Extend `FoodNameCombobox` to match saved meals by name (excluding archived), render them with a "meal" badge, and expose an `onSelectMeal` branch distinct from `onSelectFood`; keep meals out of the focused-empty suggestion groups.
- [x] 5.3 Wire `EntryForm` so selecting a meal in the picker opens `LogMealSheet` (into the form's current slot/date) instead of pre-filling fields, and closes the form on successful log.
- [x] 5.4 Change the `EntryForm` slot `<legend>`/`aria-label` from "Meal" to "When".
- [x] 5.5 Tests: meal appears/badged on name match, selecting it opens the sheet (not a prefill), confirm fans out into entries under the chosen slot, skipped/all-unavailable paths.

## 6. Validation & wrap-up

- [x] 6.1 Run `openspec validate add-saved-meals --strict` and fix any issues.
- [x] 6.2 Run the full test suite and typecheck; confirm totals, weekly-deficit, and burn-sync are unaffected by fanned-out entries.

## Why

Foods that are really an assembly of several library foods — a taco salad of beans, lettuce, turkey taco meat, and cheese — have to be logged one component at a time, every time. There is no way to save that grouping and re-log it in one gesture. Users want to define such a combination once, from foods they already have, and log the whole thing later.

## What Changes

- Introduce a **saved meal**: a named, reusable grouping of library foods with a portion (amount + unit) for each component. A meal stores **references, not nutrition** — its total is always computed live from the current component foods, so editing a component or its portion updates every future log.
- Add a **Meals tab** to the food library screen, listing saved meals with their live total and an expandable component breakdown.
- **Create a meal by multi-selecting foods** in the library's Foods tab ("Create meal from N foods"), which opens a builder that seeds each selected food at 1 serving; the user names the meal and adjusts portions before saving. Meals can be edited and archived like foods.
- **Log a meal from the entry form's name picker**: saved meals are matched by name as the user types (alongside library foods) and shown with a "meal" badge. Selecting one opens a **confirm sheet** listing the components, their live total, and the target meal slot; confirming **fans the meal out into ordinary food entries**, one per component, each snapshotted and linked to its component library food.
- **Archived or missing components are skipped** at log time, with a note on the confirm sheet indicating how many were unavailable.
- Naming: the composite is called a **"Meal"** in the UI but is named `SavedMeal` in code to avoid colliding with the existing `Meal` slot type (breakfast/lunch/dinner/snacks); no database rename or migration of the slot. The entry form's slot selector legend changes from "Meal" to "When" so the word "Meal" refers only to the composite in the UI.
- Explicitly **out of scope**: saved meals do NOT participate in the per-meal "recent" and "most used" suggestion groups. Those remain food-only. Meals surface only via name-match search.

## Capabilities

### New Capabilities
- `saved-meals`: Defining, storing, editing, and archiving named groupings of library foods with per-component portions; logging a meal by fanning it out into ordinary food entries via a confirm sheet, skipping unavailable components.

### Modified Capabilities
- `food-library`: The library management screen gains Foods/Meals tabs and a multi-select "create meal from selected foods" flow; the entry form's name-search dropdown additionally matches saved meals by name and, when a meal is selected, branches to the meal-log confirm sheet instead of pre-filling the entry form.

## Impact

- **New**: `SavedMeal` type; `getMeals` / `addMeal` / `updateMeal` / `archiveMeal` on `StorageRepository` and `SupabaseRepository` (plus a meals table); `saved_meals` state and CRUD + a fan-out logger in `AppState`; a meal builder component; a meal-log confirm sheet component.
- **Modified**: `FoodsScreen` (tabs + multi-select mode); `FoodNameCombobox` (match and badge meals, branch on meal selection); `EntryForm` slot legend text.
- **Untouched**: daily totals, weekly-deficit, serving-units, and the external burn sync — the fan-out produces plain `FoodEntry` rows those already consume. Logging a meal reuses the existing entry-logging path rather than introducing a new entry shape.

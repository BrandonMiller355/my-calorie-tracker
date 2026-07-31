## Context

The app models everything flat: a `LibraryFood` is per-serving nutrition + a serving anchor, and a `FoodEntry` is a snapshot that copies nutrition at log time and links back via `foodId`. There is no concept of a food composed of other foods. Persistence goes exclusively through `StorageRepository` (IndexedDB today, `SupabaseRepository` in practice); `AppState` holds session state and wraps all repo mutations. The entry form's name picker (`FoodNameCombobox`) is the shared surface for choosing what to log. See proposal.md - Why.

## Goals / Non-Goals

**Goals:**
- Add saved meals as reference-based groupings that reuse the existing food/entry/serving machinery rather than extending it.
- Keep the logged output of a meal indistinguishable from individually logged foods, so no downstream consumer (totals, weekly-deficit, burn-sync) changes.

**Non-Goals:**
- No meal-usage tracking; meals stay out of the recency/most-used suggestion groups (proposal.md scope).
- No slot rename or DB migration of `entries.meal`.
- No nested/composite entry type.

## Decisions

### Meal stores references, computes nutrition on demand
`SavedMeal = { id, name, items: MealComponent[], archivedAt? }` where `MealComponent = { foodId, amount, unit }`. No nutrition is stored on the meal or its components. A helper resolves components against the current `foods` list and reuses `deriveQuantity` (serving-units) to compute each contribution and the meal total.

- *Why:* editability is the whole reason B (compose) was chosen over flattening — bumping a component or fixing a food's macros must flow through automatically. Storing snapshots would reintroduce staleness.
- *Alternative rejected:* snapshotting nutrition onto the meal (simpler reads, but stale and defeats the point).

### Logging fans out through the existing add-entry path
Confirming the meal-log sheet resolves each available component to the same `NewEntryInput` the entry form builds today (component food's nutrition + anchor snapshot, `quantity` from `deriveQuantity`, `foodId` set, `source: 'manual'`), and calls the existing `addEntry` once per component. A new `AppState.logMeal(mealId, slot, date)` orchestrates this.

- *Why:* reuses auto-capture/link, totals, and snapshot semantics with zero new entry shape. B1 (fan-out) was chosen precisely so entries stay ordinary.
- *Alternative rejected:* a batch repo method that writes entries directly (bypasses the single tested logging path; risks divergence).

### Meal identity is dropped on logged entries
Resulting entries carry only their component `foodId`, not the meal id. Consistent with the fan-out decision and the non-goal of meal usage tracking; nothing needs to reconstruct "this came from a meal."

### Naming: `SavedMeal` in code, "Meal" in UI
The `Meal` slot type is untouched. The composite is `SavedMeal`/`MealComponent` in code and labeled "Meal" in the UI. The entry form's slot `<legend>`/`aria-label` changes from "Meal" to "When" so the visible word "Meal" only ever means the composite.

- *Why:* avoids a broad rename + `entries.meal` DB migration for a cosmetic win (Path 1). The only visible-word overlap is removed at the one place it occurs.

### Meal search reuses combobox, branches on selection
`FoodNameCombobox` gains a meals group matched by name (a `matchMeals` helper parallel to `matchFoods`), rendered with a badge and a distinct select handler. Selecting a food fills the form as today; selecting a meal calls back to open the confirm sheet. Meals are excluded from the focused-empty suggestion groups.

### Builder seeded from multi-select
The Foods view gains a select mode; "create meal from N foods" opens a builder holding a working list of components, each defaulting to `{ amount: 1, unit: food.servingLabel }`. Per-component unit options come from `availableUnits(food anchor)`, matching the entry form. Save validates a non-empty name, ≥1 component, and normalized-name dedup against existing meals.

## Risks / Trade-offs

- **Dangling component references** (food archived/removed after being added to a meal) → resolve-and-skip at log time; the confirm sheet reports the skipped count; all-unavailable blocks logging with a message. Meal storage keeps the reference (re-adding the food restores it).
- **Confirm sheet is a new interaction the picker didn't have** (picking an item used to only fill fields) → contained to a single new component; a mistap is cancelable before any entry is written.
- **Meal total is computed, not stored** → slightly more work per render, but the lists are small and this is the source of the freshness guarantee.
- **`SavedMeal` renders as "Meal" (code/UI mismatch)** → documented with a comment at the type and label sites.

## Open Questions

None blocking. Deferrable: whether to later let a meal component reference a raw quantity of a food not yet in the library (out of scope now — components reference existing library foods only).

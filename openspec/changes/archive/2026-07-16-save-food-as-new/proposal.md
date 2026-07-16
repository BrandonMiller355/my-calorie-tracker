## Why

Many library foods are small variations on one another — the same base with a different brand, prep, or serving anchor. Today the only way to create one is "+ Add food item" and retyping every field from scratch, even though an existing food already carries 90% of the values. Starting from a saved food and tweaking it is the natural gesture, and the library's edit form already holds exactly the right starting state.

## What Changes

- The library food edit form gains a secondary **"Save as new food"** action that creates a *new* library food from the current form values, leaving the food being edited untouched.
- The action is revealed only once the name in the form diverges from the name of the food being edited. With the name unchanged there is nothing to reveal: the library deduplicates on normalized name, so a copy under the same name could never be saved.
- **"Save changes"** remains the primary action and keeps its current behavior in full, including renaming a food in place. Divergent name ≠ forced fork; the user picks.
- The existing normalized-name duplicate check guards both paths — a "Save as new" whose name collides with some *other* library food is rejected with the same field error as today.
- Not in scope: the entry form's "Edit nutrition" library-update flow (per the food-logging capability) is unchanged. Logging is a poor moment to curate the library.
- Not in scope: a "Duplicate" action on the library list row. The rename path is the only entry point for now; the discoverability cost is accepted and revisitable.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `food-library`: the "Library management" requirement gains save-as-new behavior on the edit form — forking a saved food into a new one, gated on a diverged name, with the original left intact and dedup enforced on both save paths.

## Impact

- `src/screens/FoodsScreen.tsx` — `FoodForm` gains the conditional secondary action and a save-mode branch in `handleSubmit`; the duplicate check at the top of submit must key off the intended mode rather than the presence of `editing`.
- Both save paths already exist in state: `addFood` and `updateFood` from `useAppState`. No storage, schema, or type changes.
- Tests: `src/screens/` currently has no `FoodsScreen.test.tsx`; this change adds coverage for the fork, the in-place rename, and the collision case.

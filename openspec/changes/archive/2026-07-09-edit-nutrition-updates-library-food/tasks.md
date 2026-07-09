## 1. EntryForm: resolve and reveal

- [x] 1.1 In `src/components/EntryForm.tsx`, add `showLibraryAnchorEditor = nutritionOpen && !!matchedFood`, seeding `anchorFields` from `matchedFood`'s anchor when it becomes true (mirroring how `showAnchorEditor` seeds from `prefill`).
- [x] 1.2 Render the existing serving-def row (label / equals / unit) when `showLibraryAnchorEditor` is true, reusing the same JSX/handlers as the `showAnchorEditor` block rather than duplicating markup.
- [x] 1.3 Add an inline note ("Updates your food library") next to the revealed fields when `showLibraryAnchorEditor` is true; no note when nutrition is entry-only (no `matchedFood`).

## 2. EntryForm: save flow

- [x] 2.1 In `handleSubmit`, when `matchedFood` is set and `nutritionOpen` is true, validate the anchor fields with `validateServingAnchor` (same as the new-food path) and build the updated `LibraryFood` from `matchedFood` + the entered anchor/nutrition values.
- [x] 2.2 After the entry save (`addEntry`/`updateEntry`, unchanged), call `updateFood` with that updated food; on failure, set `saveFailed` (reuse the existing banner) without rolling back the already-saved entry.
- [x] 2.3 Confirm the entry itself still saves its own snapshot of the entered anchor/nutrition values (no change to `addEntry`/`updateEntry` call shape).
- [x] 2.4 Confirm no `updateFood` call happens when `matchedFood` is undefined (never captured, name edited away from a match, or linked food archived/deleted) or when `nutritionOpen` was never opened.

## 3. Tests

- [x] 3.1 Update the existing test `'a macro tweak while logging does not overwrite the library food'` in `src/App.test.tsx` (around line 476) to reflect the new behavior: after editing nutrition through the reveal and saving, the library food's calories DO change to the edited value.
- [x] 3.2 Add a test: editing an existing logged entry's nutrition (via `updateEntry`) updates the linked library food, while a second, previously-logged entry for that same food keeps its original stored values.
- [x] 3.3 Add a test: editing nutrition on an entry with no `foodId` (or whose linked food was archived) shows only nutrition inputs and does not create/modify any library food.
- [x] 3.4 Add a test: revealing "Edit nutrition" for a matched food shows the serving label/equivalence fields pre-filled from the library food, and changing the equivalence and saving updates the library food's anchor (verify via the Foods screen or a repository spy).
- [x] 3.5 Run the full test suite and fix any other test relying on the old "nutrition edits from the entry form never touch the library" behavior.

## 4. Spec sync

- [x] 4.1 After implementation is verified, run the archive step to sync `openspec/specs/food-logging/spec.md` and `openspec/specs/food-library/spec.md` with this change's delta specs.

## 1. Save-mode plumbing in FoodForm

- [x] 1.1 Rework `handleSubmit` in `src/screens/FoodsScreen.tsx` to take an explicit save mode (`'update' | 'create'`) from the clicked action instead of deriving it from the `editing` prop
- [x] 1.2 Make the duplicate check mode-aware: `'update'` exempts `editing.id` as today, `'create'` exempts nothing so a fork onto the edited food's own name is rejected
- [x] 1.3 Route `'create'` to `addFood({ ...parsed, source: 'manual' })` and `'update'` to `updateFood({ ...editing, ...parsed })`, keeping the existing saving/failure state handling for both

## 2. Conditional "Save as new food" action

- [x] 2.1 Derive name divergence from `normalizeFoodName` (`src/lib/foodMatch.ts`) comparing form name to `editing.name`, so case- and whitespace-only edits do not count as diverged
- [x] 2.2 Render "Save as new food" as a secondary action in `.form-actions` only while editing and diverged; keep "Save changes" primary, always present, and unchanged in behavior
- [x] 2.3 Confirm the create-mode form (no `editing`) is unaffected and still shows only "Add to library"

## 3. Tests

- [x] 3.1 Add `src/screens/FoodsScreen.test.tsx` covering the fork: edit a food, change name + calories, "Save as new food" → new food added, original untouched
- [x] 3.2 Cover the reveal gate: no action when name unchanged, and none when only case/whitespace differs
- [x] 3.3 Cover in-place rename via "Save changes" after a name change → no second food created
- [x] 3.4 Cover the collision case (fork onto a third food's name → duplicate error, nothing saved) and the withdrawal case (restoring the original name removes the fork action)

## 4. Verification

- [x] 4.1 Run the test suite and typecheck
- [x] 4.2 Drive the flow in the running app: fork a real library food, confirm both foods appear in the library list and in name search from the entry form
